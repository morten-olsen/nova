import type { Mechanic } from '../mechanics.base.js';

import { getAndroid, launchAndroid, requireDeploymentBay } from './android.helpers.js';

const androidMechanicsLaunch: Mechanic = {
  name: 'android.launch',
  apply: ({ world, event, rules }) => {
    if (event.type !== 'android.launch') {
      return;
    }

    const android = getAndroid(world, event.androidId);
    const bay = requireDeploymentBay(world, android, rules);

    launchAndroid({
      world,
      ownerId: android.ownerId,
      scriptId: event.scriptId,
      position: bay.position,
      rules,
    });
  },
};

export { androidMechanicsLaunch };
