import { addMaterials } from '../../schemas/schemas.resources.js';
import type { Mechanic } from '../mechanics.base.js';

const gameMechanicsExtractResources: Mechanic = {
  name: 'game.extract-resources',
  apply: ({ world, event }) => {
    if (event.type !== 'game.round-end') {
      return;
    }

    for (const building of world.buildings) {
      if (building.type !== 'extractor' || building.remainingConstruction.ticks > 0) {
        continue;
      }

      const tile = world.tiles.find(
        (candidate) => candidate.position.x === building.position.x && candidate.position.y === building.position.y,
      );
      if (!tile) {
        continue;
      }

      building.storage = addMaterials(building.storage, {
        ore: Math.min(2, tile.composition.ore ?? 0),
        water: Math.min(1, tile.composition.water ?? 0),
        acidCanister: Math.min(1, tile.composition.acid ?? 0),
      });
    }
  },
};

export { gameMechanicsExtractResources };
