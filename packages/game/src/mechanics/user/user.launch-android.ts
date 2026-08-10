import type { Mechanic } from '../mechanics.base.js';
import { launchAndroid } from '../android/android.helpers.js';

import { ensurePlayer } from './user.helpers.js';

const userMechanicsLaunchAndroid: Mechanic = {
  name: 'user.launch-android',
  apply: ({ world, event }) => {
    if (event.type !== 'user.launch-android') {
      return;
    }

    ensurePlayer(world, event.ownerId);

    launchAndroid({ world, ownerId: event.ownerId, scriptId: event.scriptId });
  },
};

export { userMechanicsLaunchAndroid };
