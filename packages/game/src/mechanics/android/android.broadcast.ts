import type { Mechanic } from '../mechanics.base.js';

import { getAndroid } from './android.helpers.js';

const androidMechanicsBroadcast: Mechanic = {
  name: 'android.broadcast',
  apply: ({ world, event, rules }) => {
    if (event.type !== 'android.broadcast') {
      return;
    }

    const android = getAndroid(world, event.androidId);
    if (event.content.length > rules.android.broadcastLimit) {
      throw new Error(`A broadcast is limited to ${rules.android.broadcastLimit} characters`);
    }

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
