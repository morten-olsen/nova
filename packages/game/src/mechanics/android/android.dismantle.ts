import type { Mechanic } from '../mechanics.base.js';

import { getAndroid } from './android.helpers.js';

const androidMechanicsDismantle: Mechanic = {
  name: 'android.dismantle',
  apply: ({ world, event }) => {
    if (event.type !== 'android.dismantle') {
      return;
    }

    const android = getAndroid(world, event.androidId);
    android.active = false;
    android.health = 0;
  },
};

export { androidMechanicsDismantle };
