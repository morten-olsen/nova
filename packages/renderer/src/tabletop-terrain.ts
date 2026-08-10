import type { World } from '@morten-olsen/nova-game';

import { novaPalette, novaTerrain } from './nova-palette.js';
import { fbm, ridged, tileRandom } from './tabletop-noise.js';
import { getTileOrigin, pixelsPerTile, type BoardBounds } from './tabletop-bounds.js';

type Rgb = [number, number, number];

/**
 * The soft colour field is generated at this resolution and scaled up. The
 * ground is low-frequency by nature, so sampling it per texture pixel bought
 * nothing but a slow paint.
 */
const fieldPixelsPerTile = 24;

const toRgb = (hex: string): Rgb => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
];

const mix = (from: Rgb, to: Rgb, amount: number): Rgb => [
  from[0] + (to[0] - from[0]) * amount,
  from[1] + (to[1] - from[1]) * amount,
  from[2] + (to[2] - from[2]) * amount,
];

const shadow = toRgb(novaTerrain.shadow);
const low = toRgb(novaTerrain.low);
const mid = toRgb(novaTerrain.mid);
const high = toRgb(novaTerrain.high);
const mineral = toRgb(novaTerrain.mineral);

/** Regolith ramp: three bands, so elevation reads as material change not just brightness. */
const sampleRamp = (elevation: number): Rgb => {
  if (elevation < 0.35) {
    return mix(shadow, low, elevation / 0.35);
  }
  if (elevation < 0.68) {
    return mix(low, mid, (elevation - 0.35) / 0.33);
  }
  return mix(mid, high, (elevation - 0.68) / 0.32);
};

/** Board-space coordinates for a field pixel, in tile units. */
const toBoardSpace = (index: number, bounds: BoardBounds): { x: number; y: number } => {
  const columns = bounds.width * fieldPixelsPerTile;
  return {
    x: bounds.minX + ((index % columns) + 0.5) / fieldPixelsPerTile,
    y: bounds.minY + (Math.floor(index / columns) + 0.5) / fieldPixelsPerTile,
  };
};

const createColourField = (bounds: BoardBounds): HTMLCanvasElement => {
  const field = document.createElement('canvas');
  field.width = bounds.width * fieldPixelsPerTile;
  field.height = bounds.height * fieldPixelsPerTile;
  const context = field.getContext('2d');
  if (!context) {
    throw new Error('Unable to create the terrain colour field');
  }
  const image = context.createImageData(field.width, field.height);
  for (let pixel = 0; pixel < image.data.length / 4; pixel += 1) {
    const { x, y } = toBoardSpace(pixel, bounds);
    // Two scales of drift plus a ridged vein mask, all continuous across tiles.
    const elevation = fbm(x * 0.5, y * 0.5, 11, 4) * 0.72 + fbm(x * 1.7, y * 1.7, 29, 3) * 0.28;
    const vein = ridged(x * 0.85, y * 0.85, 53, 3) ** 3;
    const colour = mix(sampleRamp(elevation), mineral, vein * 0.55);
    image.data[pixel * 4] = colour[0];
    image.data[pixel * 4 + 1] = colour[1];
    image.data[pixel * 4 + 2] = colour[2];
    image.data[pixel * 4 + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return field;
};

/** Wind-blown dust, drawn as soft smears so the ground is not uniformly grainy. */
const paintDustDrifts = (context: CanvasRenderingContext2D, bounds: BoardBounds): void => {
  const drifts = Math.round(bounds.width * bounds.height * 0.3) + 4;
  context.save();
  // Kept faint and tight. Wider, stronger smears read as smoke sitting above the
  // board rather than dust lying on it.
  context.filter = `blur(${Math.round(pixelsPerTile * 0.18)}px)`;
  for (let index = 0; index < drifts; index += 1) {
    const x = tileRandom(index, 3, 71) * bounds.width * pixelsPerTile;
    const y = tileRandom(index, 9, 83) * bounds.height * pixelsPerTile;
    const length = pixelsPerTile * (0.7 + tileRandom(index, 17, 91) * 1.5);
    const angle = (tileRandom(index, 23, 97) - 0.5) * 1.1;
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.fillStyle = `rgb(192 170 138 / ${0.016 + tileRandom(index, 31, 101) * 0.03})`;
    context.beginPath();
    context.ellipse(0, 0, length, pixelsPerTile * 0.2, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
  context.restore();
};

/** Loose rock, the only high-frequency detail. Gives the eye a sense of scale. */
const paintRockScatter = (context: CanvasRenderingContext2D, bounds: BoardBounds): void => {
  for (let tileX = bounds.minX; tileX <= bounds.maxX; tileX += 1) {
    for (let tileY = bounds.minY; tileY <= bounds.maxY; tileY += 1) {
      const origin = getTileOrigin({ x: tileX, y: tileY }, bounds);
      const count = 1 + Math.floor(tileRandom(tileX, tileY, 5) * 3);
      for (let index = 0; index < count; index += 1) {
        const x = origin.x + tileRandom(tileX + index * 7, tileY, 13) * pixelsPerTile;
        const y = origin.y + tileRandom(tileX, tileY + index * 7, 19) * pixelsPerTile;
        const size = 2 + tileRandom(tileX + index, tileY + index, 23) * 5;
        context.fillStyle = `rgb(26 20 16 / ${0.3 + tileRandom(tileX, tileY, 29) * 0.25})`;
        context.beginPath();
        context.moveTo(x, y - size);
        context.lineTo(x + size, y + size * 0.5);
        context.lineTo(x - size * 0.75, y + size * 0.85);
        context.closePath();
        context.fill();
        context.fillStyle = 'rgb(196 178 150 / 0.22)';
        context.beginPath();
        context.moveTo(x, y - size);
        context.lineTo(x + size * 0.45, y - size * 0.1);
        context.lineTo(x - size * 0.3, y);
        context.closePath();
        context.fill();
      }
    }
  }
};

/**
 * The tile grid, engraved rather than drawn on: a dark score with a lit lower
 * edge. This is what keeps the surface reading as a manufactured game board
 * laid over terrain, which is the whole design intent.
 */
const paintGridInlay = (context: CanvasRenderingContext2D, bounds: BoardBounds): void => {
  const width = bounds.width * pixelsPerTile;
  const height = bounds.height * pixelsPerTile;
  context.lineWidth = 1;
  for (let column = 0; column <= bounds.width; column += 1) {
    const x = column * pixelsPerTile;
    context.strokeStyle = 'rgb(12 9 7 / 0.5)';
    context.beginPath();
    context.moveTo(x - 0.5, 0);
    context.lineTo(x - 0.5, height);
    context.stroke();
    context.strokeStyle = `rgb(124 140 168 / 0.16)`;
    context.beginPath();
    context.moveTo(x + 0.5, 0);
    context.lineTo(x + 0.5, height);
    context.stroke();
  }
  for (let row = 0; row <= bounds.height; row += 1) {
    const y = row * pixelsPerTile;
    context.strokeStyle = 'rgb(12 9 7 / 0.5)';
    context.beginPath();
    context.moveTo(0, y - 0.5);
    context.lineTo(width, y - 0.5);
    context.stroke();
    context.strokeStyle = `rgb(124 140 168 / 0.16)`;
    context.beginPath();
    context.moveTo(0, y + 0.5);
    context.lineTo(width, y + 0.5);
    context.stroke();
  }
};

/** Cells inside the bounding box that have no tile are not part of the board. */
const punchOutMissingTiles = (context: CanvasRenderingContext2D, bounds: BoardBounds, world: World): void => {
  const present = new Set(world.tiles.map((tile) => `${tile.position.x}:${tile.position.y}`));
  for (let tileX = bounds.minX; tileX <= bounds.maxX; tileX += 1) {
    for (let tileY = bounds.minY; tileY <= bounds.maxY; tileY += 1) {
      if (present.has(`${tileX}:${tileY}`)) {
        continue;
      }
      const origin = getTileOrigin({ x: tileX, y: tileY }, bounds);
      context.fillStyle = novaPalette.void;
      context.fillRect(origin.x, origin.y, pixelsPerTile, pixelsPerTile);
    }
  }
};

type TerrainPaintOptions = {
  bounds: BoardBounds;
  context: CanvasRenderingContext2D;
  world: World;
};

/**
 * Paints the static ground. Only re-run when the board's shape changes — the
 * animated hazard layer lives in its own texture.
 */
const paintTerrain = ({ bounds, context, world }: TerrainPaintOptions): void => {
  const width = bounds.width * pixelsPerTile;
  const height = bounds.height * pixelsPerTile;
  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.drawImage(createColourField(bounds), 0, 0, width, height);
  paintDustDrifts(context, bounds);
  paintRockScatter(context, bounds);
  paintGridInlay(context, bounds);
  punchOutMissingTiles(context, bounds, world);
};

export { paintTerrain };
