import { isBuildingComplete } from '../../utils/utils.building.js';
import type { Mechanic } from '../mechanics.base.js';
import { getAndroid, getBuildingAt, takeFromAndroidCargo } from '../android/android.helpers.js';

/**
 * Puts building health back, at the cost of material and a turn.
 *
 * The answer to salvage. Sabotage used to be unopposable: a raider stood on a
 * building and the owner's only reply was to build somewhere else, which made
 * hostile salvage the best-paid action in the game and the initial charger's
 * immunity a special case rather than a rule. Repair costs `rules.salvage`'s
 * repair price per action, so holding ground against a determined raider is
 * paid for in metal and android-turns — a contest, rather than a wall.
 *
 * Own buildings only: repairing a rival's infrastructure is not a thing anyone
 * needs to do, and allowing it would let an Android quietly outpace a partner's
 * salvage on a building neither of them owns.
 */
const constructionMechanicsRepair: Mechanic = {
  name: 'construction.repair',
  apply: ({ world, event, rules }) => {
    if (event.type !== 'android.repair') {
      return;
    }

    const android = getAndroid(world, event.androidId);
    const building = getBuildingAt(world, android.position);
    if (!building || building.ownerId !== android.ownerId) {
      throw new Error('Android must be on one of its own buildings to repair');
    }

    if (!isBuildingComplete(building)) {
      throw new Error('A building under construction is continued, not repaired');
    }

    const full = rules.buildings[building.type].health;
    if (building.health >= full) {
      throw new Error(`This ${building.type} is not damaged`);
    }

    takeFromAndroidCargo(android, rules.salvage.repairCost);
    building.health = Math.min(full, building.health + rules.salvage.repairAmount);
  },
};

export { constructionMechanicsRepair };
