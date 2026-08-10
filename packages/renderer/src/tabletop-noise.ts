/**
 * Spatially coherent value noise.
 *
 * The board previously hashed each tile independently, which produced a
 * high-contrast checkerboard — neighbouring tiles had no relationship, so the
 * ground read as cork tiles rather than continuous terrain. Everything here
 * interpolates between lattice points so features cross tile boundaries.
 */

const hashLattice = (x: number, y: number, seed: number): number => {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return value - Math.floor(value);
};

/** Smoothstep, so the interpolation has no visible lattice creases. */
const smooth = (t: number): number => t * t * (3 - 2 * t);

const valueNoise = (x: number, y: number, seed: number): number => {
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);
  const fractionX = smooth(x - cellX);
  const fractionY = smooth(y - cellY);
  const topLeft = hashLattice(cellX, cellY, seed);
  const topRight = hashLattice(cellX + 1, cellY, seed);
  const bottomLeft = hashLattice(cellX, cellY + 1, seed);
  const bottomRight = hashLattice(cellX + 1, cellY + 1, seed);
  const top = topLeft + (topRight - topLeft) * fractionX;
  const bottom = bottomLeft + (bottomRight - bottomLeft) * fractionX;
  return top + (bottom - top) * fractionY;
};

/** Fractal Brownian motion: octaves of value noise, halving amplitude. */
const fbm = (x: number, y: number, seed: number, octaves = 4): number => {
  let total = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let normalisation = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    total += valueNoise(x * frequency, y * frequency, seed + octave * 17) * amplitude;
    normalisation += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return total / normalisation;
};

/**
 * Ridged noise, for the sharper mineral veining that breaks up the ochre.
 * Folding the noise around 0.5 turns smooth blobs into creases.
 */
const ridged = (x: number, y: number, seed: number, octaves = 3): number =>
  1 - Math.abs(fbm(x, y, seed, octaves) * 2 - 1);

/** Deterministic per-tile random in [0, 1), for scatter placement. */
const tileRandom = (x: number, y: number, seed: number): number => hashLattice(x * 3.7 + 11, y * 5.3 + 7, seed);

export { fbm, ridged, tileRandom, valueNoise };
