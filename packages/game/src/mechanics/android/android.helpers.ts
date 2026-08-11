import type { Rules } from '../../rules/rules.js';
import type { Position } from '../../schemas/schemas.base.js';
import {
  addMaterials,
  hasMaterials,
  materialAmount,
  normalizeMaterials,
  subtractMaterials,
  type MaterialBundle,
} from '../../schemas/schemas.resources.js';
import { isBuildingComplete } from '../../utils/utils.building.js';
import type { Android } from '../../schemas/schemas.android.js';
import type { Building } from '../../schemas/schemas.building.js';
import type { World } from '../../schemas/schemas.world.js';

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

/**
 * The completed buildings that carry their owner's android capacity.
 *
 * Read off `androidCapacity` rather than off the charger type, so a ruleset that
 * moves deployment capacity onto another building needs no code change.
 */
const capacityBuildingsForOwner = (world: World, ownerId: string, rules: Rules): Building[] => {
  return world.buildings.filter(
    (building) =>
      building.ownerId === ownerId &&
      rules.buildings[building.type].androidCapacity > 0 &&
      isBuildingComplete(building),
  );
};

const androidCapacityForOwner = (world: World, ownerId: string, rules: Rules): number =>
  capacityBuildingsForOwner(world, ownerId, rules).reduce(
    (total, building) => total + rules.buildings[building.type].androidCapacity,
    0,
  );

/**
 * The building an android has to stand on to operate its owner's deployment bay —
 * launching a new android or dismantling one of its siblings.
 */
const requireDeploymentBay = (world: World, android: Android, rules: Rules): Building => {
  const bay = getBuildingAt(world, android.position);
  if (
    !bay ||
    bay.ownerId !== android.ownerId ||
    !capacityBuildingsForOwner(world, android.ownerId, rules).some((candidate) => candidate.id === bay.id)
  ) {
    throw new Error('Android must be on an owned completed charger');
  }

  return bay;
};

/**
 * Ids stay stable across a replay because they are derived from the world.
 * Destroyed androids stay in the array as deactivated wrecks, but a hand-written
 * or migrated world can still have gaps, so the count alone would reissue an id
 * that is already taken.
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
  rules: Rules;
  /** Defaults to the owner's first capacity-carrying building. */
  position?: Position;
};

/**
 * Deploys an android against its owner's charger capacity.
 *
 * Shared by `user.launch-android` and `android.launch` so that an android
 * launching a sibling is held to the same capacity limit as its player.
 */
const launchAndroid = (options: LaunchAndroidOptions): Android => {
  const { world, ownerId, scriptId, position, rules } = options;

  const script = world.scripts.find((candidate) => candidate.id === scriptId && candidate.ownerId === ownerId);
  if (!script) {
    throw new Error(`Unknown script for owner: ${scriptId}`);
  }

  const capacity = androidCapacityForOwner(world, ownerId, rules);
  const activeAndroids = world.androids.filter((android) => android.ownerId === ownerId && android.active).length;
  if (activeAndroids >= capacity) {
    throw new Error(`Android capacity reached for owner: ${ownerId}`);
  }

  const bays = capacityBuildingsForOwner(world, ownerId, rules);
  const spawnPosition = position ?? bays[0]?.position ?? world.tiles[0]?.position ?? { x: 0, y: 0 };
  const android: Android = {
    id: nextAndroidId(world),
    ownerId,
    scriptId,
    position: { ...spawnPosition },
    battery: rules.android.startingBattery,
    health: rules.android.startingHealth,
    active: true,
    cargo: { metal: 0, electronics: 0, polymer: 0 },
    memory: '',
    recording: '',
  };
  world.androids.push(android);
  return android;
};

const addToAndroidCargo = (android: Android, resources: Partial<MaterialBundle>, capacity: number): void => {
  android.cargo = normalizeMaterials(android.cargo);
  if (materialAmount(android.cargo) + materialAmount(resources) > capacity) {
    throw new Error('Android cargo capacity exceeded');
  }

  android.cargo = addMaterials(android.cargo, resources);
};

export {
  addToAndroidCargo,
  androidCapacityForOwner,
  capacityBuildingsForOwner,
  getAndroid,
  getBuildingAt,
  getTileAt,
  launchAndroid,
  nextAndroidId,
  requireDeploymentBay,
  samePosition,
  takeFromAndroidCargo,
};
