import type { Mechanic } from '../mechanics.base.js';

const androidMechanicsUpdateState: Mechanic = {
  name: 'android.update-state',
  apply: ({ world, event }) => {
    if (!('memory' in event) && !('recording' in event)) {
      return;
    }

    const android = world.androids.find((candidate) => candidate.id === event.androidId && candidate.active);
    if (!android) {
      throw new Error(`Unknown active android: ${event.androidId}`);
    }

    if (event.memory !== undefined) {
      android.memory = event.memory;
    }
    if (event.recording !== undefined) {
      android.recording = event.recording;
    }
  },
};

export { androidMechanicsUpdateState };
