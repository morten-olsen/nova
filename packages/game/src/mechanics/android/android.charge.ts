import { isBuildingComplete } from '../../utils/utils.building.js';
import type { Mechanic } from '../mechanics.base.js';

import { getAndroid, getBuildingAt } from './android.helpers.js';

const androidMechanicsCharge: Mechanic = {
  name: 'android.charge',
  apply: ({ world, event, rules }) => {
    if (event.type !== 'android.charge') {
      return;
    }

    const android = getAndroid(world, event.androidId);
    const building = getBuildingAt(world, android.position);
    const charge = building ? rules.buildings[building.type].charge : 0;
    // Completed, like every other thing a building does: a site that has been
    // placed and not paid for is a free charger anywhere on the map otherwise.
    if (!building || building.ownerId !== android.ownerId || charge <= 0 || !isBuildingComplete(building)) {
      throw new Error('Android must be on an owned completed charger to charge');
    }

    android.battery = Math.min(rules.android.batteryCapacity, android.battery + charge);
  },
};

export { androidMechanicsCharge };
