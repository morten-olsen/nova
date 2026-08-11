import {
  addMaterials,
  materialKeys,
  normalizeMaterials,
  type MaterialBundle,
} from '../../schemas/schemas.resources.js';
import { investedMaterials } from '../../utils/utils.building.js';
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
    if (!own && !rules.buildings[building.type].salvageableByOthers) {
      throw new Error(`A ${building.type} cannot be salvaged by another player`);
    }

    building.health -= own ? rules.salvage.ownDamage : rules.salvage.hostileDamage;

    if (building.health > 0) {
      return;
    }

    const returnRate = own ? rules.salvage.ownReturnRate : rules.salvage.hostileReturnRate;
    // A share of what went into this building, not of what the type costs: a site
    // that was placed and never supplied has had nothing invested in it, so
    // taking it apart returns nothing. Against the full cost, placing a colony
    // module site and salvaging it was 54 units of material out of an empty hold.
    const invested = investedMaterials(building, rules.buildings[building.type].cost);
    const salvage: MaterialBundle = {};
    for (const material of materialKeys) {
      salvage[material] = Math.floor((invested[material] ?? 0) * returnRate);
    }

    const tile = world.tiles.find(
      (candidate) => candidate.position.x === building.position.x && candidate.position.y === building.position.y,
    );
    if (tile) {
      // Whatever was stored inside comes out onto the ground in full. It was
      // never part of the building, and a depot coming down should spill its
      // stockpile for whoever is standing there — including a raider, which is
      // what makes hostile salvage a robbery rather than pure vandalism.
      tile.scattered = addMaterials(addMaterials(tile.scattered, salvage), normalizeMaterials(building.storage));
    }

    world.buildings = world.buildings.filter((candidate) => candidate.id !== building.id);
  },
};

export { constructionMechanicsSalvage };
