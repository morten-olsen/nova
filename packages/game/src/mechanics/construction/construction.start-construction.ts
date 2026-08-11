import { hasMaterials, materialKeys, subtractMaterials, type MaterialBundle } from '../../schemas/schemas.resources.js';
import type { Mechanic } from '../mechanics.base.js';
import { getAndroid, getBuildingAt, getTileAt, takeFromAndroidCargo } from '../android/android.helpers.js';

const compactMaterials = (materials: MaterialBundle): MaterialBundle => {
  const compact: MaterialBundle = {};
  for (const key of materialKeys) {
    const value = materials[key] ?? 0;
    if (value !== 0) {
      compact[key] = value;
    }
  }
  return compact;
};

const constructionMechanicsStartConstruction: Mechanic = {
  name: 'construction.start-construction',
  apply: ({ world, event, rules }) => {
    if (event.type !== 'android.start-construction') {
      return;
    }

    const android = getAndroid(world, event.androidId);
    if (getBuildingAt(world, android.position)) {
      throw new Error('A tile can only contain one building');
    }

    const building = rules.buildings[event.buildingType];
    const supplied = event.resources ?? {};
    if (hasMaterials(android.cargo, supplied)) {
      takeFromAndroidCargo(android, supplied);
    } else {
      const tile = getTileAt(world, android.position);
      if (!tile) {
        throw new Error('Android is not on a tile');
      }

      if (hasMaterials(tile.scattered, supplied)) {
        tile.scattered = subtractMaterials(tile.scattered, supplied);
      } else {
        const legacyComposition = tile.composition as { metal?: number };
        const requiredLegacyMetal = supplied.metal ?? 0;
        if ((legacyComposition.metal ?? 0) >= requiredLegacyMetal) {
          legacyComposition.metal = (legacyComposition.metal ?? 0) - requiredLegacyMetal;
        } else {
          takeFromAndroidCargo(android, supplied);
        }
      }
    }

    world.buildings.push({
      id: `building-${world.buildings.length + 1}`,
      ownerId: android.ownerId,
      type: event.buildingType,
      position: { ...android.position },
      health: building.health,
      storage: building.storage
        ? { metal: 0, electronics: 0, polymer: 0, ore: 0, water: 0, acidCanister: 0 }
        : undefined,
      initial: false,
      remainingConstruction: {
        ticks: building.ticks,
        resources: compactMaterials(subtractMaterials(building.cost, supplied)),
      },
    });
  },
};

export { constructionMechanicsStartConstruction };
