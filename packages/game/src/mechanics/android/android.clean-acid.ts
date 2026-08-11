import type { Direction, Position } from '../../schemas/schemas.base.js';
import { addMaterials } from '../../schemas/schemas.resources.js';
import type { Mechanic } from '../mechanics.base.js';

import { getAndroid, getTileAt } from './android.helpers.js';

const adjacentPosition = (position: Position, direction: Direction): Position => {
  if (direction === 'north') {
    return { x: position.x, y: position.y - 1 };
  }

  if (direction === 'south') {
    return { x: position.x, y: position.y + 1 };
  }

  if (direction === 'east') {
    return { x: position.x + 1, y: position.y };
  }

  return { x: position.x - 1, y: position.y };
};

const androidMechanicsCleanAcid: Mechanic = {
  name: 'android.clean-acid',
  apply: ({ world, event, rules }) => {
    if (event.type !== 'android.clean-acid') {
      return;
    }

    const android = getAndroid(world, event.androidId);
    const acidPlant = world.buildings.find(
      (building) =>
        building.ownerId === android.ownerId &&
        rules.buildings[building.type].cleansAcid &&
        building.remainingConstruction.ticks === 0,
    );
    if (!acidPlant) {
      throw new Error('Android owner needs a completed acid processing plant to clean acid');
    }

    const target = getTileAt(world, adjacentPosition(android.position, event.direction));
    if (!target) {
      throw new Error('Cannot clean acid outside the map');
    }

    const acid = target.composition.acid ?? 0;
    if (acid <= 0) {
      throw new Error('Target tile has no acid to clean');
    }

    const cleaned = Math.min(acid, rules.android.cleanAcidAmount);
    target.composition.acid = acid - cleaned;
    acidPlant.storage = addMaterials(acidPlant.storage, { acidCanister: cleaned });
    android.battery -= rules.android.cleanAcidBatteryCost;
  },
};

export { androidMechanicsCleanAcid };
