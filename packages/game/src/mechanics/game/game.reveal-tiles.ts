import type { Position } from '../../schemas/schemas.base.js';
import type { Mechanic } from '../mechanics.base.js';

const distance = (left: Position, right: Position): number => Math.abs(left.x - right.x) + Math.abs(left.y - right.y);

const revealTiles = (
  world: Parameters<NonNullable<Mechanic['apply']>>[0]['world'],
  ownerId: string,
  position: Position,
  range: number,
): void => {
  for (const tile of world.tiles) {
    if (distance(tile.position, position) > range) {
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
  apply: ({ world, event }) => {
    if (event.type !== 'game.round-end') {
      return;
    }

    for (const android of world.androids) {
      if (android.active) {
        revealTiles(world, android.ownerId, android.position, 2);
      }
    }

    for (const building of world.buildings) {
      if (building.type === 'scanner' && building.remainingConstruction.ticks === 0) {
        revealTiles(world, building.ownerId, building.position, 4);
      }
    }
  },
};

export { gameMechanicsRevealTiles };
