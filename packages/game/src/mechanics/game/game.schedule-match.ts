import type { Mechanic } from '../mechanics.base.js';

/**
 * Writes the round the humans are expected on — the scheduled end of the match —
 * into the world.
 *
 * It lives in the world rather than only in the rules because a script reads it
 * as the `finalTurn` global, and because a recording should still say when its
 * match was meant to end. A ruleset with no scheduled arrival leaves the field
 * absent rather than setting it to something a script would have to interpret.
 */
const gameMechanicsScheduleMatch: Mechanic = {
  name: 'game.schedule-match',
  setup: ({ world, rules }) => {
    if (rules.match.finalRound !== null) {
      world.finalRound = rules.match.finalRound;
    }
  },
};

export { gameMechanicsScheduleMatch };
