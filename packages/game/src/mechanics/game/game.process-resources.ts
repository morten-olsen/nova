import { addMaterials, hasMaterials, subtractMaterials } from '../../schemas/schemas.resources.js';
import { isBuildingComplete } from '../../utils/utils.building.js';
import type { Mechanic } from '../mechanics.base.js';

const gameMechanicsProcessResources: Mechanic = {
  name: 'game.process-resources',
  apply: ({ world, event, rules }) => {
    if (event.type !== 'game.round-end') {
      return;
    }

    for (const building of world.buildings) {
      const { conversion } = rules.buildings[building.type];
      if (!conversion || !isBuildingComplete(building)) {
        continue;
      }

      // Each recipe once per round, in the order the rules list them, against the
      // storage as the previous one left it: a refinery that turns ore into metal
      // and metal into electronics can do both in a round, but only one batch of
      // each. Throughput is bought with more buildings rather than with a fuller
      // depot.
      for (const recipe of conversion) {
        if (!hasMaterials(building.storage, recipe.input)) {
          continue;
        }

        building.storage = subtractMaterials(building.storage, recipe.input);
        building.storage = addMaterials(building.storage, recipe.output);
      }
    }
  },
};

export { gameMechanicsProcessResources };
