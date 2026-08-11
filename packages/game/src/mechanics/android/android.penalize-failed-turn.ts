import type { Mechanic } from '../mechanics.base.js';

/**
 * Health lost by an Android whose turn was refused.
 *
 * A failed turn is a script bug, not a death sentence: it costs the round and
 * some durability, so a script that keeps making the same mistake still wears
 * its Android down, but one bad edge case no longer ends the run.
 */
const failedTurnHealthPenalty = 10;

const androidMechanicsPenalizeFailedTurn: Mechanic = {
  name: 'android.penalize-failed-turn',
  apply: ({ world, event }) => {
    if (event.type !== 'game.android-failed-turn') {
      return;
    }

    const android = world.androids.find((candidate) => candidate.id === event.androidId && candidate.active);
    if (android) {
      android.health -= failedTurnHealthPenalty;
    }
  },
};

export { androidMechanicsPenalizeFailedTurn, failedTurnHealthPenalty };
