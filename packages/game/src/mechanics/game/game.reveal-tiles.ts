import type { SightRules } from '../../rules/rules.sight.js';
import type { Position } from '../../schemas/schemas.base.js';
import type { World } from '../../schemas/schemas.world.js';
import type { Mechanic } from '../mechanics.base.js';

/** See {@link SightRules} for why the two shapes are measured differently. */
const isWithinSight = (left: Position, right: Position, { range, shape }: SightRules): boolean => {
  const dx = left.x - right.x;
  const dy = left.y - right.y;

  if (shape === 'circular') {
    return dx * dx + dy * dy <= range * range;
  }

  return Math.abs(dx) + Math.abs(dy) <= range;
};

const revealTiles = (world: World, ownerId: string, position: Position, sight: SightRules): void => {
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

const gameMechanicsRevealTiles: Mechanic = {
  name: 'game.reveal-tiles',
  apply: ({ world, event, rules }) => {
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
        revealTiles(world, android.ownerId, android.position, rules.android.sight);
      }
    }

    for (const building of world.buildings) {
      const { sight } = rules.buildings[building.type];
      if (sight && building.remainingConstruction.ticks === 0) {
        revealTiles(world, building.ownerId, building.position, sight);
      }
    }
  },
};

export { gameMechanicsRevealTiles };
