import type { Android } from '../../schemas/schemas.android.js';
import type { BuildingType } from '../../schemas/schemas.building.js';
import {
  hasMaterials,
  materialKeys,
  normalizeMaterials,
  subtractMaterials,
  type MaterialBundle,
} from '../../schemas/schemas.resources.js';
import type { World } from '../../schemas/schemas.world.js';
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

/**
 * Refuses material the building has no use for.
 *
 * A cost is a list of what a building is made of, not a total to be reached with
 * anything to hand: material the cost does not mention used to be accepted and
 * quietly burned, and — because what a site still owes is measured as a total
 * across every material — enough of it drove that total below zero, which is a
 * depot bought with ten units of worthless ore and no metal at all.
 */
const requireCostMaterials = (buildingType: BuildingType, cost: MaterialBundle, supplied: MaterialBundle): void => {
  for (const material of materialKeys) {
    if ((supplied[material] ?? 0) > (cost[material] ?? 0)) {
      throw new Error(`A ${buildingType} does not need that much ${material}`);
    }
  }
};

/** Takes the payment out of cargo, or off the ground the android is standing on. */
const paySupplied = (world: World, android: Android, supplied: MaterialBundle): void => {
  if (hasMaterials(android.cargo, supplied)) {
    takeFromAndroidCargo(android, supplied);
    return;
  }

  const tile = getTileAt(world, android.position);
  if (!tile) {
    throw new Error('Android is not on a tile');
  }

  if (hasMaterials(tile.scattered, supplied)) {
    tile.scattered = subtractMaterials(tile.scattered, supplied);
    return;
  }

  const legacyComposition = tile.composition as { metal?: number };
  const requiredLegacyMetal = supplied.metal ?? 0;
  if ((legacyComposition.metal ?? 0) >= requiredLegacyMetal) {
    legacyComposition.metal = (legacyComposition.metal ?? 0) - requiredLegacyMetal;
    return;
  }

  // Throws, and says which material is missing rather than which store was empty.
  takeFromAndroidCargo(android, supplied);
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
    const cost = normalizeMaterials(building.cost);
    const supplied = event.resources ?? {};
    requireCostMaterials(event.buildingType, cost, supplied);
    paySupplied(world, android, supplied);

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
        resources: compactMaterials(subtractMaterials(cost, supplied)),
      },
    });
  },
};

export { constructionMechanicsStartConstruction };
