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

/** Chargers that count towards their owner's android capacity. */
const completedChargersForOwner = (world: World, ownerId: string): Building[] => {
  return world.buildings.filter(
    (building) =>
      building.ownerId === ownerId &&
      building.type === 'charger' &&
      building.remainingConstruction.ticks === 0 &&
      materialAmount(building.remainingConstruction.resources) === 0,
  );
};

/**
 * The charger an android has to stand on to operate its owner's deployment bay —
 * launching a new android or dismantling one of its siblings.
 */
const requireOperatingCharger = (world: World, android: Android): Building => {
  const charger = getBuildingAt(world, android.position);
  if (
    !charger ||
    charger.ownerId !== android.ownerId ||
    charger.type !== 'charger' ||
    !completedChargersForOwner(world, android.ownerId).some((candidate) => candidate.id === charger.id)
  ) {
    throw new Error('Android must be on an owned completed charger');
  }

  return charger;
};

/**
 * Ids stay stable across a replay because they are derived from the world, but
 * destroyed androids leave the array, so the count alone would reissue an id
 * that is still in use.
 */
const nextAndroidId = (world: World): string => {
  const taken = new Set(world.androids.map((android) => android.id));
  let index = world.androids.length + 1;
  while (taken.has(`android-${index}`)) {
    index += 1;
  }

  return `android-${index}`;
};

type LaunchAndroidOptions = {
  world: World;
  ownerId: string;
  scriptId: string;
  /** Defaults to the owner's first completed charger. */
  position?: Position;
};

/**
 * Deploys an android against its owner's charger capacity.
 *
 * Shared by `user.launch-android` and `android.launch` so that an android
 * launching a sibling is held to the same capacity limit as its player.
 */
const launchAndroid = (options: LaunchAndroidOptions): Android => {
  const { world, ownerId, scriptId, position } = options;

  const script = world.scripts.find((candidate) => candidate.id === scriptId && candidate.ownerId === ownerId);
  if (!script) {
    throw new Error(`Unknown script for owner: ${scriptId}`);
  }

  const chargers = completedChargersForOwner(world, ownerId);
  const activeAndroids = world.androids.filter((android) => android.ownerId === ownerId && android.active).length;
  if (activeAndroids >= chargers.length) {
    throw new Error(`Android capacity reached for owner: ${ownerId}`);
  }

  const spawnPosition = position ?? chargers[0]?.position ?? world.tiles[0]?.position ?? { x: 0, y: 0 };
  const android: Android = {
    id: nextAndroidId(world),
    ownerId,
    scriptId,
    position: { ...spawnPosition },
    battery: 100,
    health: 100,
    active: true,
    cargo: { metal: 0, electronics: 0, polymer: 0 },
    memory: '',
    recording: '',
  };
  world.androids.push(android);
  return android;
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
  completedChargersForOwner,
  getAndroid,
  getBuildingAt,
  getTileAt,
  launchAndroid,
  materialAmount,
  nextAndroidId,
  requireOperatingCharger,
  samePosition,
  takeFromAndroidCargo,
};
