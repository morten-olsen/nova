import type { Mechanic } from '../mechanics.base.js';

import { getAndroid, getTileAt } from './android.helpers.js';

const androidMechanicsMove: Mechanic = {
  name: 'android.move',
  apply: ({ world, event, rules }) => {
    if (event.type !== 'android.move') {
      return;
    }

    const android = getAndroid(world, event.androidId);
    const position = { ...android.position };

    if (event.direction === 'north') {
      position.y -= 1;
    }
    if (event.direction === 'south') {
      position.y += 1;
    }
    if (event.direction === 'east') {
      position.x += 1;
    }
    if (event.direction === 'west') {
      position.x -= 1;
    }

    if (!getTileAt(world, position)) {
      throw new Error('Cannot move outside the map');
    }

    android.position = position;
    android.battery -= rules.android.moveBatteryCost;
  },
};

export { androidMechanicsMove };
