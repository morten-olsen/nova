import type { Mechanic } from '../mechanics.base.js';

/**
 * Applies the `memory` and `recording` an action carried.
 *
 * The two limits are enforced here rather than in the event schema, because they
 * are rules: a ruleset that gives Androids a bigger notebook should not need a
 * new event schema to allow it. Over-length writes are refused like any other
 * illegal action — the turn fails and neither field changes.
 */
const androidMechanicsUpdateState: Mechanic = {
  name: 'android.update-state',
  apply: ({ world, event, rules }) => {
    if (!('memory' in event) && !('recording' in event)) {
      return;
    }

    const android = world.androids.find((candidate) => candidate.id === event.androidId && candidate.active);
    if (!android) {
      throw new Error(`Unknown active android: ${event.androidId}`);
    }

    const { memoryLimit, recordingLimit } = rules.android;
    if (event.memory !== undefined) {
      if (event.memory.length > memoryLimit) {
        throw new Error(`Android memory is limited to ${memoryLimit} characters`);
      }
      android.memory = event.memory;
    }
    if (event.recording !== undefined) {
      if (event.recording.length > recordingLimit) {
        throw new Error(`Android recording is limited to ${recordingLimit} characters`);
      }
      android.recording = event.recording;
    }
  },
};

export { androidMechanicsUpdateState };
