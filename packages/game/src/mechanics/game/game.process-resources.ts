import { addMaterials, hasMaterials, subtractMaterials } from '../../schemas/schemas.resources.js';
import type { Mechanic } from '../mechanics.base.js';

const gameMechanicsProcessResources: Mechanic = {
  name: 'game.process-resources',
  apply: ({ world, event }) => {
    if (event.type !== 'game.round-end') {
      return;
    }

    for (const building of world.buildings) {
      if (building.type !== 'processor' || building.remainingConstruction.ticks > 0) {
        continue;
      }

      if (!hasMaterials(building.storage, { ore: 2 })) {
        continue;
      }

      building.storage = subtractMaterials(building.storage, { ore: 2 });
      building.storage = addMaterials(building.storage, { metal: 1 });
    }
  },
};

export { gameMechanicsProcessResources };
