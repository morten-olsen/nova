import { addMaterials, hasMaterials, subtractMaterials } from '../../schemas/schemas.resources.js';
import type { Mechanic } from '../mechanics.base.js';

const gameMechanicsProcessResources: Mechanic = {
  name: 'game.process-resources',
  apply: ({ world, event, rules }) => {
    if (event.type !== 'game.round-end') {
      return;
    }

    for (const building of world.buildings) {
      const { conversion } = rules.buildings[building.type];
      if (!conversion || building.remainingConstruction.ticks > 0) {
        continue;
      }

      // One batch per round, whatever the storage holds: throughput is bought
      // with more processors rather than with a fuller depot.
      if (!hasMaterials(building.storage, conversion.input)) {
        continue;
      }

      building.storage = subtractMaterials(building.storage, conversion.input);
      building.storage = addMaterials(building.storage, conversion.output);
    }
  },
};

export { gameMechanicsProcessResources };
