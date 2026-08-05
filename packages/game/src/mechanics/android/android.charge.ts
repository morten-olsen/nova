import type { Mechanic } from '../mechanics.base.js';

import { getAndroid, getBuildingAt } from './android.helpers.js';

const androidMechanicsCharge: Mechanic = {
  name: 'android.charge',
  apply: ({ world, event }) => {
    if (event.type !== 'android.charge') {
      return;
    }

    const android = getAndroid(world, event.androidId);
    const building = getBuildingAt(world, android.position);
    if (!building || building.ownerId !== android.ownerId || building.type !== 'charger') {
      throw new Error('Android must be on an owned charger to charge');
    }

    android.battery = Math.min(100, android.battery + 25);
  },
};

export { androidMechanicsCharge };
