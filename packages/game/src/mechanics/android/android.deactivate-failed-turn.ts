import type { Mechanic } from '../mechanics.base.js';

const androidMechanicsDeactivateFailedTurn: Mechanic = {
  name: 'android.deactivate-failed-turn',
  apply: ({ world, event }) => {
    if (event.type !== 'game.android-failed-turn') {
      return;
    }

    const android = world.androids.find((candidate) => candidate.id === event.androidId);
    if (android) {
      android.active = false;
    }
  },
};

export { androidMechanicsDeactivateFailedTurn };
