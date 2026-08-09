import * as THREE from 'three';

type ParticleEmitter = {
  color: THREE.Color;
  id: string;
  position: THREE.Vector3;
  rate: number;
};

type ParticleSystem = {
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

const setParticleColor = (colors: Float32Array, index: number, color: THREE.Color, opacity: number): void => {
  colors[index * 3] = color.r * opacity;
  colors[index * 3 + 1] = color.g * opacity;
  colors[index * 3 + 2] = color.b * opacity;
};

const createConstructionParticles = (scene: THREE.Scene, capacity = 360): ParticleSystem => {
  const { colorAttribute, colors, geometry, material, points, positionAttribute, positions } =
    createParticleBuffers(capacity);
  const particles = Array.from({ length: capacity }, (): Particle => ({
    color: new THREE.Color(),
    life: 0,
    lifetime: 0,
    velocity: new THREE.Vector3(),
  }));
  scene.add(points);
  const emissionDebt = new Map<string, number>();

  const spawnParticle = (emitter: ParticleEmitter): void => {
    const index = particles.findIndex((particle) => particle.life <= 0);
    const particle = particles[index];
    if (!particle) {
      return;
    }
    particle.lifetime = 0.42 + Math.random() * 0.4;
    particle.life = particle.lifetime;
    particle.color.copy(emitter.color);
    particle.velocity.set((Math.random() - 0.5) * 0.34, 0.6 + Math.random() * 0.62, (Math.random() - 0.5) * 0.34);
    positions[index * 3] = emitter.position.x + (Math.random() - 0.5) * 0.24;
    positions[index * 3 + 1] = emitter.position.y;
    positions[index * 3 + 2] = emitter.position.z + (Math.random() - 0.5) * 0.24;
    setParticleColor(colors, index, particle.color, 1);
  };

  const update = (delta: number, emitters: ParticleEmitter[]): void => {
    const activeEmitters = new Set(emitters.map((emitter) => emitter.id));
    for (const emitter of emitters) {
      const debt = (emissionDebt.get(emitter.id) ?? 0) + delta * emitter.rate;
      const spawnCount = Math.floor(debt);
      emissionDebt.set(emitter.id, debt - spawnCount);
      for (let index = 0; index < spawnCount; index += 1) {
        spawnParticle(emitter);
      }
    }
    for (const id of emissionDebt.keys()) {
      if (!activeEmitters.has(id)) {
        emissionDebt.delete(id);
      }
    }
    for (const [index, particle] of particles.entries()) {
      if (particle.life <= 0) {
        setParticleColor(colors, index, particle.color, 0);
        continue;
      }
      particle.life -= delta;
      positions[index * 3] = (positions[index * 3] ?? 0) + particle.velocity.x * delta;
      positions[index * 3 + 1] = (positions[index * 3 + 1] ?? 0) + particle.velocity.y * delta;
      positions[index * 3 + 2] = (positions[index * 3 + 2] ?? 0) + particle.velocity.z * delta;
      particle.velocity.y -= 1.8 * delta;
      setParticleColor(colors, index, particle.color, Math.max(0, particle.life / particle.lifetime) ** 2);
    }
    positionAttribute.needsUpdate = true;
    colorAttribute.needsUpdate = true;
  };

  return {
    update,
    dispose: (): void => {
      points.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
};

export type { ParticleEmitter, ParticleSystem };
export { createConstructionParticles };
