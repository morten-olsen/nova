import type { World } from '@morten-olsen/nova-game';

import { novaPalette } from './nova-palette.js';
import { getTileOrigin, pixelsPerTile, type BoardBounds } from './tabletop-bounds.js';

/** Mask resolution. Low is fine — the mask is heavily blurred on the way out. */
const maskPixelsPerTile = 12;
/** Reveal speed. Slow enough to read as fog withdrawing, fast enough not to lag. */
const revealRate = 3.2;
const settleEpsilon = 0.002;

const isRevealed = (revealedBy: string[] | undefined): boolean => (revealedBy?.length ?? 0) > 0;

const getKey = (x: number, y: number): string => `${x}:${y}`;

/**
 * Whether *this* world has any revealed tile.
 *
 * Only safe as a fallback when nothing better is known. Tiles are revealed at
 * round end, so the opening frame of a real game legitimately has none — using
 * this per-frame would wrongly disable fog exactly when the board should be
 * fully dark. Callers that can see the whole recording should decide instead and
 * pass `enabled` explicitly.
 */
const hasFogData = (world: World): boolean => world.tiles.some((tile) => isRevealed(tile.revealedBy));

type FogPaintOptions = {
  bounds: BoardBounds;
  context: CanvasRenderingContext2D;
  world: World;
};

/** Reveal amount per tile key, 0 (fogged) to 1 (fully visible). */
type RevealAmounts = Map<string, number>;

/** Opaque where unexplored, transparent where visible, per-tile alpha between. */
const createMask = (amounts: RevealAmounts, bounds: BoardBounds, world: World): HTMLCanvasElement => {
  const mask = document.createElement('canvas');
  mask.width = bounds.width * maskPixelsPerTile;
  mask.height = bounds.height * maskPixelsPerTile;
  const context = mask.getContext('2d');
  if (!context) {
    throw new Error('Unable to create the fog mask');
  }
  context.fillStyle = '#ffffff';
  for (const tile of world.tiles) {
    const revealed = amounts.get(getKey(tile.position.x, tile.position.y)) ?? 0;
    if (revealed >= 1) {
      continue;
    }
    context.globalAlpha = 1 - revealed;
    context.fillRect(
      (tile.position.x - bounds.minX) * maskPixelsPerTile,
      (tile.position.y - bounds.minY) * maskPixelsPerTile,
      maskPixelsPerTile,
      maskPixelsPerTile,
    );
  }
  return mask;
};

type FrontierOptions = {
  amounts: RevealAmounts;
  bounds: BoardBounds;
  context: CanvasRenderingContext2D;
  world: World;
};

/**
 * A faint rim on tiles bordering the unknown, so the edge of what you can see
 * reads as an active frontier. Fades with the reveal animation.
 */
const paintFrontier = ({ amounts, bounds, context, world }: FrontierOptions): void => {
  context.save();
  context.lineWidth = 2;
  for (const tile of world.tiles) {
    const { x, y } = tile.position;
    const revealed = amounts.get(getKey(x, y)) ?? 0;
    if (revealed < 0.35) {
      continue;
    }
    const origin = getTileOrigin(tile.position, bounds);
    for (const [neighbourX, neighbourY, fromX, fromY, toX, toY] of [
      [x, y - 1, 0, 0, pixelsPerTile, 0],
      [x, y + 1, 0, pixelsPerTile, pixelsPerTile, pixelsPerTile],
      [x - 1, y, 0, 0, 0, pixelsPerTile],
      [x + 1, y, pixelsPerTile, 0, pixelsPerTile, pixelsPerTile],
    ]) {
      const neighbour = amounts.get(getKey(neighbourX ?? 0, neighbourY ?? 0));
      if (neighbour === undefined || neighbour > 0.5) {
        continue;
      }
      context.strokeStyle = `rgb(56 189 248 / ${(0.24 * revealed).toFixed(3)})`;
      context.beginPath();
      context.moveTo(origin.x + (fromX ?? 0), origin.y + (fromY ?? 0));
      context.lineTo(origin.x + (toX ?? 0), origin.y + (toY ?? 0));
      context.stroke();
    }
  }
  context.restore();
};

type FogPainter = {
  /** Advances the reveal animation. Returns true when the fog needs repainting. */
  advance: (delta: number) => boolean;
  paint: (options: FogPaintOptions) => void;
  reset: () => void;
  setWorld: (world: World, enabled: boolean) => void;
};

/**
 * Fog of war with per-tile reveal animation.
 *
 * Each tile holds a 0→1 reveal amount that eases toward its target, so ground
 * uncovered during a round withdraws smoothly instead of popping — the rest of
 * the board animates, and a hard cut here read as a glitch.
 */
const createFogPainter = (): FogPainter => {
  const amounts = new Map<string, number>();
  let targets = new Map<string, number>();
  let enabled = false;

  const setWorld = (world: World, fogEnabled: boolean): void => {
    enabled = fogEnabled;
    targets = new Map(
      world.tiles.map((tile) => [getKey(tile.position.x, tile.position.y), isRevealed(tile.revealedBy) ? 1 : 0]),
    );
    // Unknown tiles start fogged, so the opening frame settles as fully dark
    // rather than animating in from nothing.
    for (const key of targets.keys()) {
      if (!amounts.has(key)) {
        amounts.set(key, 0);
      }
    }
  };

  const advance = (delta: number): boolean => {
    if (!enabled) {
      return false;
    }
    const alpha = 1 - Math.exp(-revealRate * delta);
    let changed = false;
    for (const [key, target] of targets) {
      const current = amounts.get(key) ?? 0;
      const difference = target - current;
      if (Math.abs(difference) < settleEpsilon) {
        if (current !== target) {
          amounts.set(key, target);
          changed = true;
        }
        continue;
      }
      amounts.set(key, current + difference * alpha);
      changed = true;
    }
    return changed;
  };

  const paint = ({ bounds, context, world }: FogPaintOptions): void => {
    const width = bounds.width * pixelsPerTile;
    const height = bounds.height * pixelsPerTile;
    context.clearRect(0, 0, width, height);
    if (!enabled) {
      return;
    }
    const fog = document.createElement('canvas');
    fog.width = width;
    fog.height = height;
    const fogContext = fog.getContext('2d');
    if (!fogContext) {
      return;
    }
    fogContext.fillStyle = novaPalette.fog;
    fogContext.fillRect(0, 0, width, height);
    fogContext.globalCompositeOperation = 'destination-in';
    fogContext.filter = `blur(${Math.round(pixelsPerTile * 0.22)}px)`;
    fogContext.imageSmoothingEnabled = true;
    fogContext.drawImage(createMask(amounts, bounds, world), 0, 0, width, height);

    context.save();
    context.globalAlpha = 0.95;
    context.drawImage(fog, 0, 0);
    context.restore();
    paintFrontier({ amounts, bounds, context, world });
  };

  const reset = (): void => {
    amounts.clear();
    targets.clear();
  };

  return { advance, paint, reset, setWorld };
};

export type { FogPainter };
export { createFogPainter, hasFogData };
