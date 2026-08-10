import type { Position } from '../../schemas/schemas.base.js';
import type { BuildingType } from '../../schemas/schemas.building.js';
import type { Mechanic } from '../mechanics.base.js';

type World = Parameters<NonNullable<Mechanic['apply']>>[0]['world'];

/**
 * Sight shapes differ per source, and the difference is deliberate.
 *
 * `stepped` counts orthogonal steps, so its footprint is a diamond: it is the
 * range an Android could actually walk, which is what makes short-range sight
 * feel like the piece looking around itself.
 *
 * `circular` is true Euclidean distance, so its footprint is a disc. A radar
 * sweeps, it does not walk, and at radius 5 a diamond would look like an
 * obvious lozenge on the board rather than a sweep.
 */
type SightShape = 'stepped' | 'circular';

type Sight = {
  range: number;
  shape: SightShape;
};

const isWithinSight = (left: Position, right: Position, { range, shape }: Sight): boolean => {
  const dx = left.x - right.x;
  const dy = left.y - right.y;

  if (shape === 'circular') {
    return dx * dx + dy * dy <= range * range;
  }

  return Math.abs(dx) + Math.abs(dy) <= range;
};

const revealTiles = (world: World, ownerId: string, position: Position, sight: Sight): void => {
  for (const tile of world.tiles) {
    if (!isWithinSight(tile.position, position, sight)) {
      continue;
    }

    tile.revealedBy ??= [];
    if (!tile.revealedBy.includes(ownerId)) {
      tile.revealedBy.push(ownerId);
    }
  }
};

const androidSight: Sight = { range: 2, shape: 'stepped' };

/** Sight granted by each completed building type. Types absent from this map see nothing. */
const buildingSight: Partial<Record<BuildingType, Sight>> = {
  scanner: { range: 4, shape: 'stepped' },
  radar: { range: 5, shape: 'circular' },
};

const gameMechanicsRevealTiles: Mechanic = {
  name: 'game.reveal-tiles',
  apply: ({ world, event }) => {
    if (event.type !== 'game.round-end') {
      return;
    }

    // Visibility is current line of sight, not permanent discovery: recompute it
    // from scratch every round so ground stops being visible once nothing is in
    // range of it. Androids retain knowledge through `memory` and broadcasts,
    // not through the world staying revealed.
    for (const tile of world.tiles) {
      tile.revealedBy = [];
    }

    for (const android of world.androids) {
      if (android.active) {
        revealTiles(world, android.ownerId, android.position, androidSight);
      }
    }

    for (const building of world.buildings) {
      const sight = buildingSight[building.type];
      if (sight && building.remainingConstruction.ticks === 0) {
        revealTiles(world, building.ownerId, building.position, sight);
      }
    }
  },
};

export { gameMechanicsRevealTiles };
