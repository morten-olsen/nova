import type { Mechanic } from '../mechanics.base.js';

import { getAndroid } from './android.helpers.js';

const androidMechanicsBroadcast: Mechanic = {
  name: 'android.broadcast',
  apply: ({ world, event }) => {
    if (event.type !== 'android.broadcast') {
      return;
    }

    const android = getAndroid(world, event.androidId);
    world.messages ??= [];
    world.messages.push({
      id: `message-${world.messages.length + 1}`,
      senderAndroidId: android.id,
      ownerId: android.ownerId,
      position: { ...android.position },
      content: event.content,
      round: world.round ?? 0,
    });
  },
};

export { androidMechanicsBroadcast };
