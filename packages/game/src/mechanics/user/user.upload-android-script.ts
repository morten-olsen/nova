import type { Mechanic } from '../mechanics.base.js';

import { ensurePlayer } from './user.helpers.js';

const userMechanicsUploadAndroidScript: Mechanic = {
  name: 'user.upload-android-script',
  apply: ({ world, event, rules }) => {
    if (event.type !== 'user.upload-android-script') {
      return;
    }

    ensurePlayer(world, event.ownerId, rules);
    world.scripts.push({
      id: `script-${world.scripts.length + 1}`,
      ownerId: event.ownerId,
      name: event.name,
      content: event.content,
    });
  },
};

export { userMechanicsUploadAndroidScript };
