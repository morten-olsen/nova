import type { Tile, World } from '@morten-olsen/nova-game';

import { fbm, tileRandom } from './tabletop-noise.js';
import { getPixelPosition, pixelsPerTile, type BoardBounds } from './tabletop-bounds.js';

/**
 * An organic puddle outline. Perturbing the radius with noise sampled *around*
 * the circle keeps the edge continuous while making it irregular — the previous
 * rounded rectangles read as green plastic tiles.
 */
type Puddle = {
  centre: { x: number; y: number };
  elapsed: number;
  radius: number;
  seed: number;
};

const tracePuddle = (context: CanvasRenderingContext2D, { centre, elapsed, radius, seed }: Puddle): void => {
  const steps = 18;
  context.beginPath();
  for (let step = 0; step <= steps; step += 1) {
    const angle = (step / steps) * Math.PI * 2;
    const wobble =
      0.74 +
      fbm(Math.cos(angle) * 1.5 + seed, Math.sin(angle) * 1.5 + seed, 17, 2) * 0.46 +
      Math.sin(elapsed * 1.3 + angle * 3 + seed) * 0.025;
    const x = centre.x + Math.cos(angle) * radius * wobble;
    const y = centre.y + Math.sin(angle) * radius * wobble * 0.84;
    if (step === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.closePath();
};

const drawAcidBubbles = (context: CanvasRenderingContext2D, { centre, elapsed, radius }: Puddle, tile: Tile): void => {
  for (let index = 0; index < 4; index += 1) {
    const seed = tile.position.x * 13 + tile.position.y * 7 + index * 31;
    const drift = (elapsed * 0.5 + index * 0.37) % 1;
    const angle = tileRandom(tile.position.x + index, tile.position.y, 131) * Math.PI * 2;
    const distance = radius * 0.55 * tileRandom(tile.position.x, tile.position.y + index, 137);
    const pulse = (Math.sin(elapsed * 2.6 + seed) + 1) / 2;
    const bubbleRadius = 1.1 + pulse * 2.2;
    context.fillStyle = `rgb(198 226 120 / ${0.14 + pulse * 0.24})`;
    context.beginPath();
    context.arc(
      centre.x + Math.cos(angle) * distance,
      centre.y + Math.sin(angle) * distance * 0.84 - drift * radius * 0.35,
      bubbleRadius,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
};

/**
 * Acid pools are drawn opaque into a scratch layer and composited once, so
 * pools on neighbouring tiles merge into a single body of liquid instead of
 * showing a seam wherever two tiles' alpha overlapped.
 */
const toPuddle = (tile: Tile, bounds: BoardBounds, elapsed: number): Puddle => ({
  centre: getPixelPosition(tile.position, bounds),
  elapsed,
  radius: pixelsPerTile * 0.46,
  seed: tile.position.x * 2.3 + tile.position.y * 3.7,
});

const drawAcidSurface = (scratch: CanvasRenderingContext2D, puddle: Puddle, tile: Tile): void => {
  const { centre, radius } = puddle;
  scratch.save();
  tracePuddle(scratch, puddle);
  scratch.clip();
  const sheen = scratch.createLinearGradient(
    centre.x - radius,
    centre.y - radius,
    centre.x + radius,
    centre.y + radius,
  );
  sheen.addColorStop(0, 'rgb(150 190 70 / 0.32)');
  sheen.addColorStop(0.5, 'rgb(90 120 30 / 0.05)');
  sheen.addColorStop(1, 'rgb(40 56 12 / 0.3)');
  scratch.fillStyle = sheen;
  scratch.fillRect(centre.x - radius * 1.4, centre.y - radius * 1.4, radius * 2.8, radius * 2.8);
  drawAcidBubbles(scratch, puddle, tile);
  scratch.restore();
  tracePuddle(scratch, { ...puddle, radius: radius * 1.005 });
  scratch.strokeStyle = 'rgb(180 214 96 / 0.5)';
  scratch.lineWidth = 1.4;
  scratch.stroke();
};

const drawAcidPools = (scratch: CanvasRenderingContext2D, world: World, bounds: BoardBounds, elapsed: number): void => {
  const acidTiles = world.tiles.filter((tile) => (tile.composition.acid ?? 0) > 0);
  // Bodies first, so overlapping pools merge before any edge or sheen is drawn.
  for (const tile of acidTiles) {
    tracePuddle(scratch, toPuddle(tile, bounds, elapsed));
    scratch.fillStyle = '#3f5216';
    scratch.fill();
  }
  for (const tile of acidTiles) {
    drawAcidSurface(scratch, toPuddle(tile, bounds, elapsed), tile);
  }
};

/** Radiation as a drifting violet haze. Never opaque: tile state must stay readable. */
const drawRadiation = (context: CanvasRenderingContext2D, world: World, bounds: BoardBounds, elapsed: number): void => {
  for (const tile of world.tiles) {
    const amount = tile.composition.radiation ?? 0;
    if (amount <= 0) {
      continue;
    }
    const centre = getPixelPosition(tile.position, bounds);
    for (let index = 0; index < 3; index += 1) {
      const offsetX =
        (tileRandom(tile.position.x, tile.position.y, index + 14) - 0.5) * pixelsPerTile * 0.42 +
        Math.sin(elapsed * 0.42 + index * 3) * 4;
      const offsetY =
        (tileRandom(tile.position.x, tile.position.y, index + 19) - 0.5) * pixelsPerTile * 0.42 +
        Math.cos(elapsed * 0.33 + index * 2) * 3;
      const radius =
        pixelsPerTile * (0.22 + tileRandom(tile.position.x, tile.position.y, index + 27) * 0.15) +
        Math.sin(elapsed + index) * 2;
      const x = centre.x + offsetX;
      const y = centre.y + offsetY;
      const gradient = context.createRadialGradient(x, y, radius * 0.1, x, y, radius);
      gradient.addColorStop(0, `rgb(186 164 220 / ${0.09 + amount * 0.02})`);
      gradient.addColorStop(0.55, `rgb(126 112 156 / ${0.04 + amount * 0.014})`);
      gradient.addColorStop(1, 'rgb(126 112 156 / 0)');
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  }
};

type HazardPaintOptions = {
  bounds: BoardBounds;
  context: CanvasRenderingContext2D;
  elapsed: number;
  scratch: CanvasRenderingContext2D;
  world: World;
};

const paintHazards = ({ bounds, context, elapsed, scratch, world }: HazardPaintOptions): void => {
  const width = bounds.width * pixelsPerTile;
  const height = bounds.height * pixelsPerTile;
  context.clearRect(0, 0, width, height);
  scratch.clearRect(0, 0, width, height);
  drawAcidPools(scratch, world, bounds, elapsed);
  context.save();
  context.globalAlpha = 0.88;
  context.drawImage(scratch.canvas, 0, 0);
  context.restore();
  drawRadiation(context, world, bounds, elapsed);
};

export { paintHazards };
