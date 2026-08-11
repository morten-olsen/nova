import { createGameMechanics } from '../mechanics/game/game.js';
import type { RulesInput } from '../rules/rules.js';

import { Ruleset } from './ruleset.js';

/**
 * The game as it ships, optionally retuned.
 *
 * Every knob is a rule, so a smaller board or a harsher planet is
 * `createBaseRuleset({ world: { width: 6, height: 6 } })` rather than a
 * different set of mechanics.
 */
const createBaseRuleset = (rules: RulesInput = {}): Ruleset => {
  return new Ruleset({
    mechanics: createGameMechanics(),
    rules,
  });
};

export { createBaseRuleset };
