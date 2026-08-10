import * as THREE from 'three';

type ParticleEmitter = {
  color: THREE.Color;
  id: string;
  position: THREE.Vector3;
  rate: number;
};

type ParticleSystem = {
  /** One-shot dust ring, for a piece landing on or leaving the board. */
  burst: (position: THREE.Vector3, color: THREE.Color, count?: number) => void;
  dispose: () => void;
  update: (delta: number, emitters: ParticleEmitter[]) => void;
};

type Particle = {
  color: THREE.Color;
  life: number;
  lifetime: number;
  velocity: THREE.Vector3;
};

type ParticleBuffers = {
  colorAttribute: THREE.BufferAttribute;
  colors: Float32Array;
  geometry: THREE.BufferGeometry;
  material: THREE.PointsMaterial;
  points: THREE.Points;
  positionAttribute: THREE.BufferAttribute;
  positions: Float32Array;
};

/** Everything the pool operations below need to mutate. */
type Pool = {
  buffers: ParticleBuffers;
  emissionDebt: Map<string, number>;
  particles: Particle[];
  random: () => number;
};

const gravity = 1.8;

const createParticleBuffers = (capacity: number): ParticleBuffers => {
  const positions = new Float32Array(capacity * 3);
  const colors = new Float32Array(capacity * 3);
  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  const colorAttribute = new THREE.BufferAttribute(colors, 3);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('color', colorAttribute);
  const material = new THREE.PointsMaterial({
    size: 0.12,
    vertexColors: true,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return { colorAttribute, colors, geometry, material, points, positionAttribute, positions };
};

/**
 * Seeded PRNG (mulberry32). Deliberately not Math.random: when the renderer is
 * stepped frame by frame for video capture, particle motion has to be
 * reproducible so separately rendered chunks of the same timeline match.
 */
const createRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

const setParticleColor = (colors: Float32Array, index: number, color: THREE.Color, opacity: number): void => {
  colors[index * 3] = color.r * opacity;
  colors[index * 3 + 1] = color.g * opacity;
  colors[index * 3 + 2] = color.b * opacity;
};

const setParticlePosition = (positions: Float32Array, index: number, [x, y, z]: [number, number, number]): void => {
  positions[index * 3] = x;
  positions[index * 3 + 1] = y;
  positions[index * 3 + 2] = z;
};

/** Finds a dead particle to reuse, or undefined when the pool is saturated. */
const claim = (pool: Pool): { index: number; particle: Particle } | undefined => {
  const index = pool.particles.findIndex((particle) => particle.life <= 0);
  const particle = pool.particles[index];
  return particle ? { index, particle } : undefined;
};

const spawnFromEmitter = (pool: Pool, emitter: ParticleEmitter): void => {
  const claimed = claim(pool);
  if (!claimed) {
    return;
  }
  const { index, particle } = claimed;
  const { random } = pool;
  particle.lifetime = 0.42 + random() * 0.4;
  particle.life = particle.lifetime;
  particle.color.copy(emitter.color);
  particle.velocity.set((random() - 0.5) * 0.34, 0.6 + random() * 0.62, (random() - 0.5) * 0.34);
  setParticlePosition(pool.buffers.positions, index, [
    emitter.position.x + (random() - 0.5) * 0.24,
    emitter.position.y,
    emitter.position.z + (random() - 0.5) * 0.24,
  ]);
  setParticleColor(pool.buffers.colors, index, particle.color, 1);
};

/**
 * Kicks dust outward and slightly up, so an arrival reads as impact rather than
 * a fade-in. Reuses the same pool as the construction emitters.
 */
const spawnBurst = (pool: Pool, position: THREE.Vector3, color: THREE.Color, count: number): void => {
  for (let spawned = 0; spawned < count; spawned += 1) {
    const claimed = claim(pool);
    if (!claimed) {
      return;
    }
    const { index, particle } = claimed;
    const angle = (spawned / count) * Math.PI * 2 + pool.random() * 0.4;
    const speed = 0.5 + pool.random() * 0.5;
    particle.lifetime = 0.3 + pool.random() * 0.22;
    particle.life = particle.lifetime;
    particle.color.copy(color);
    particle.velocity.set(Math.cos(angle) * speed, 0.16 + pool.random() * 0.24, Math.sin(angle) * speed);
    setParticlePosition(pool.buffers.positions, index, [position.x, position.y + 0.03, position.z]);
    setParticleColor(pool.buffers.colors, index, particle.color, 1);
  }
};

const emit = (pool: Pool, delta: number, emitters: ParticleEmitter[]): void => {
  const active = new Set(emitters.map((emitter) => emitter.id));
  for (const emitter of emitters) {
    // Fractional spawns carry over, so low rates still emit evenly.
    const debt = (pool.emissionDebt.get(emitter.id) ?? 0) + delta * emitter.rate;
    const spawnCount = Math.floor(debt);
    pool.emissionDebt.set(emitter.id, debt - spawnCount);
    for (let index = 0; index < spawnCount; index += 1) {
      spawnFromEmitter(pool, emitter);
    }
  }
  for (const id of pool.emissionDebt.keys()) {
    if (!active.has(id)) {
      pool.emissionDebt.delete(id);
    }
  }
};

const integrate = (pool: Pool, delta: number): void => {
  const { colors, positions } = pool.buffers;
  for (const [index, particle] of pool.particles.entries()) {
    if (particle.life <= 0) {
      setParticleColor(colors, index, particle.color, 0);
      continue;
    }
    particle.life -= delta;
    setParticlePosition(positions, index, [
      (positions[index * 3] ?? 0) + particle.velocity.x * delta,
      (positions[index * 3 + 1] ?? 0) + particle.velocity.y * delta,
      (positions[index * 3 + 2] ?? 0) + particle.velocity.z * delta,
    ]);
    particle.velocity.y -= gravity * delta;
    setParticleColor(colors, index, particle.color, Math.max(0, particle.life / particle.lifetime) ** 2);
  }
};

const createConstructionParticles = (scene: THREE.Scene, capacity = 360, seed = 0x9e3779b9): ParticleSystem => {
  const buffers = createParticleBuffers(capacity);
  const pool: Pool = {
    buffers,
    emissionDebt: new Map(),
    particles: Array.from({ length: capacity }, (): Particle => ({
      color: new THREE.Color(),
      life: 0,
      lifetime: 0,
      velocity: new THREE.Vector3(),
    })),
    random: createRandom(seed),
  };
  scene.add(buffers.points);

  return {
    burst: (position, color, count = 14) => spawnBurst(pool, position, color, count),
    update: (delta, emitters) => {
      emit(pool, delta, emitters);
      integrate(pool, delta);
      buffers.positionAttribute.needsUpdate = true;
      buffers.colorAttribute.needsUpdate = true;
    },
    dispose: (): void => {
      buffers.points.removeFromParent();
      buffers.geometry.dispose();
      buffers.material.dispose();
    },
  };
};

export type { ParticleEmitter, ParticleSystem };
export { createConstructionParticles };
