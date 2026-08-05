import type { Mechanic } from '../mechanics.base.js';

const userMechanicsDismantleAndroid: Mechanic = {
  name: 'user.dismantle-android',
  apply: ({ world, event }) => {
    if (event.type !== 'user.dismantle-android') {
      return;
    }

    const android = world.androids.find(
      (candidate) => candidate.id === event.androidId && candidate.ownerId === event.ownerId,
    );
    if (!android) {
      throw new Error(`Unknown android for owner: ${event.androidId}`);
    }

    android.active = false;
    android.health = 0;
  },
};

export { userMechanicsDismantleAndroid };
