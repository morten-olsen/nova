import type { Mechanic } from '../mechanics.base.js';

import { getAndroid, requireOperatingCharger } from './android.helpers.js';

const androidMechanicsDismantle: Mechanic = {
  name: 'android.dismantle',
  apply: ({ world, event }) => {
    if (event.type !== 'android.dismantle') {
      return;
    }

    const android = getAndroid(world, event.androidId);
    if (event.targetAndroidId === undefined) {
      android.active = false;
      android.health = 0;
      return;
    }

    if (event.targetAndroidId === android.id) {
      throw new Error('Android cannot target itself; dismantle without a targetAndroidId to self-destruct');
    }

    requireOperatingCharger(world, android);

    const target = world.androids.find(
      (candidate) =>
        candidate.id === event.targetAndroidId && candidate.ownerId === android.ownerId && candidate.active,
    );
    if (!target) {
      throw new Error(`Unknown active android for owner: ${event.targetAndroidId}`);
    }

    target.active = false;
    target.health = 0;
  },
};

export { androidMechanicsDismantle };
