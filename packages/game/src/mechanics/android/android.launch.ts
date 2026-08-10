import type { Mechanic } from '../mechanics.base.js';

import { getAndroid, launchAndroid, requireOperatingCharger } from './android.helpers.js';

const androidMechanicsLaunch: Mechanic = {
  name: 'android.launch',
  apply: ({ world, event }) => {
    if (event.type !== 'android.launch') {
      return;
    }

    const android = getAndroid(world, event.androidId);
    const charger = requireOperatingCharger(world, android);

    launchAndroid({
      world,
      ownerId: android.ownerId,
      scriptId: event.scriptId,
      position: charger.position,
    });
  },
};

export { androidMechanicsLaunch };
