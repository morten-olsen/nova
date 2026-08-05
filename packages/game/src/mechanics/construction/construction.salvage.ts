import { addMaterials } from '../../schemas/schemas.resources.js';
import type { Mechanic } from '../mechanics.base.js';
import { getAndroid, getBuildingAt } from '../android/android.helpers.js';

import { buildingCosts } from './construction.defaults.js';

const constructionMechanicsSalvage: Mechanic = {
  name: 'construction.salvage',
  apply: ({ world, event }) => {
    if (event.type !== 'android.salvage') {
      return;
    }

    const android = getAndroid(world, event.androidId);
    const building = getBuildingAt(world, android.position);
    if (!building) {
      throw new Error('No building to salvage');
    }

    if (building.initial) {
      throw new Error('Initial chargers cannot be salvaged');
    }

    const damage = building.ownerId === android.ownerId ? 25 : 10;
    building.health -= damage;

    if (building.health > 0) {
      return;
    }

    const returnRate = building.ownerId === android.ownerId ? 0.6 : 0.35;
    const cost = buildingCosts[building.type];
    const salvage = {
      metal: Math.floor((cost.metal ?? 0) * returnRate),
      electronics: Math.floor((cost.electronics ?? 0) * returnRate),
      polymer: Math.floor((cost.polymer ?? 0) * returnRate),
    };
    const tile = world.tiles.find(
      (candidate) => candidate.position.x === building.position.x && candidate.position.y === building.position.y,
    );
    if (tile) {
      tile.scattered = addMaterials(tile.scattered, salvage);
    }

    world.buildings = world.buildings.filter((candidate) => candidate.id !== building.id);
  },
};

export { constructionMechanicsSalvage };
