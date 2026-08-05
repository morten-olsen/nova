import { createGameMechanics, type GameMechanicsOptions } from '../mechanics/game/game.js';

import { Ruleset } from './ruleset.js';

const createBaseRuleset = (options: GameMechanicsOptions = {}): Ruleset => {
  return new Ruleset({
    mechanics: createGameMechanics(options),
  });
};

export { createBaseRuleset };
