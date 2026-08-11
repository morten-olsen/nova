import { addMaterials, materialKeys, type MaterialBundle } from '../../schemas/schemas.resources.js';
import type { Mechanic } from '../mechanics.base.js';
import { getAndroid, getBuildingAt } from '../android/android.helpers.js';

const constructionMechanicsSalvage: Mechanic = {
  name: 'construction.salvage',
  apply: ({ world, event, rules }) => {
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

    const own = building.ownerId === android.ownerId;
    building.health -= own ? rules.salvage.ownDamage : rules.salvage.hostileDamage;

    if (building.health > 0) {
      return;
    }

    const returnRate = own ? rules.salvage.ownReturnRate : rules.salvage.hostileReturnRate;
    const cost = rules.buildings[building.type].cost;
    const salvage: MaterialBundle = {};
    for (const material of materialKeys) {
      salvage[material] = Math.floor((cost[material] ?? 0) * returnRate);
    }

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
