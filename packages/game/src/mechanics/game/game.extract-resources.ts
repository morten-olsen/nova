import {
  addMaterials,
  materialKeys,
  type MaterialBundle,
  type TileComposition,
} from '../../schemas/schemas.resources.js';
import type { Mechanic } from '../mechanics.base.js';

/**
 * Where each material comes from when it is pulled out of the ground.
 *
 * A material with no entry here is not something the planet holds — it is made,
 * not mined — so no extraction rule can harvest it however generous the rule is.
 * Acid is the one rename: it sits in the ground as `acid` and comes out canned.
 */
const compositionSource: Record<keyof MaterialBundle, keyof TileComposition | undefined> = {
  ore: 'ore',
  water: 'water',
  acidCanister: 'acid',
  metal: undefined,
  electronics: undefined,
  polymer: undefined,
};

const gameMechanicsExtractResources: Mechanic = {
  name: 'game.extract-resources',
  apply: ({ world, event, rules }) => {
    if (event.type !== 'game.round-end') {
      return;
    }

    for (const building of world.buildings) {
      const { extraction } = rules.buildings[building.type];
      if (!extraction || building.remainingConstruction.ticks > 0) {
        continue;
      }

      const tile = world.tiles.find(
        (candidate) => candidate.position.x === building.position.x && candidate.position.y === building.position.y,
      );
      if (!tile) {
        continue;
      }

      // Composition is not consumed: the ground keeps yielding, and an extractor
      // is a claim on a tile rather than a countdown on it.
      const harvested: MaterialBundle = {};
      for (const material of materialKeys) {
        const source = compositionSource[material];
        harvested[material] = source ? Math.min(extraction[material] ?? 0, tile.composition[source] ?? 0) : 0;
      }

      building.storage = addMaterials(building.storage, harvested);
    }
  },
};

export { gameMechanicsExtractResources };
