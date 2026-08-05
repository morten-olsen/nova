import type { Position } from '../../schemas/schemas.base.js';
import {
  addMaterials,
  hasMaterials,
  materialKeys,
  normalizeMaterials,
  subtractMaterials,
  type MaterialBundle,
} from '../../schemas/schemas.resources.js';
import type { Android } from '../../schemas/schemas.android.js';
import type { Building } from '../../schemas/schemas.building.js';
import type { World } from '../../schemas/schemas.world.js';

const androidCargoCapacity = 10;

const materialAmount = (materials: Partial<MaterialBundle> | undefined): number => {
  return materialKeys.reduce((total, key) => total + (materials?.[key] ?? 0), 0);
};

const samePosition = (left: Position, right: Position): boolean => left.x === right.x && left.y === right.y;

const getAndroid = (world: World, androidId: string): Android => {
  const android = world.androids.find((candidate) => candidate.id === androidId && candidate.active);
  if (!android) {
    throw new Error(`Unknown active android: ${androidId}`);
  }

  android.cargo = normalizeMaterials(android.cargo);
  return android;
};

const getTileAt = (world: World, position: Position) => {
  return world.tiles.find((tile) => samePosition(tile.position, position));
};

const getBuildingAt = (world: World, position: Position): Building | undefined => {
  return world.buildings.find((building) => samePosition(building.position, position));
};

const takeFromAndroidCargo = (android: Android, resources: Partial<MaterialBundle>): MaterialBundle => {
  android.cargo = normalizeMaterials(android.cargo);
  if (!hasMaterials(android.cargo, resources)) {
    throw new Error('Android does not have requested materials');
  }

  android.cargo = subtractMaterials(android.cargo, resources);
  return normalizeMaterials(resources);
};

const addToAndroidCargo = (android: Android, resources: Partial<MaterialBundle>): void => {
  android.cargo = normalizeMaterials(android.cargo);
  if (materialAmount(android.cargo) + materialAmount(resources) > androidCargoCapacity) {
    throw new Error('Android cargo capacity exceeded');
  }

  android.cargo = addMaterials(android.cargo, resources);
};

export {
  addToAndroidCargo,
  androidCargoCapacity,
  getAndroid,
  getBuildingAt,
  getTileAt,
  materialAmount,
  samePosition,
  takeFromAndroidCargo,
};
