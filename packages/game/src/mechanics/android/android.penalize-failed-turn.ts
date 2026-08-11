import type { Mechanic } from '../mechanics.base.js';

const androidMechanicsPenalizeFailedTurn: Mechanic = {
  name: 'android.penalize-failed-turn',
  apply: ({ world, event, rules }) => {
    if (event.type !== 'game.android-failed-turn') {
      return;
    }

    const android = world.androids.find((candidate) => candidate.id === event.androidId && candidate.active);
    if (android) {
      android.health -= rules.android.failedTurnHealthPenalty;
    }
  },
};

export { androidMechanicsPenalizeFailedTurn };
