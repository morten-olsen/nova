import { androidMechanics } from '../android/android.js';
import { constructionMechanics } from '../construction/construction.js';
import { userMechanics } from '../user/user.js';

import { gameMechanicsAdvanceRound } from './game.advance-round.js';
import { gameMechanicsCreateMap } from './game.create-map.js';
import { gameMechanicsDamageAcid } from './game.damage-acid.js';
import { gameMechanicsDecayAndroids } from './game.decay-androids.js';
import { gameMechanicsDestroyAndroids } from './game.destroy-androids.js';
import { gameMechanicsExtractResources } from './game.extract-resources.js';
import { gameMechanicsPlaceCharger } from './game.place-charger.js';
import { gameMechanicsProcessResources } from './game.process-resources.js';
import { gameMechanicsRevealTiles } from './game.reveal-tiles.js';
import { gameMechanicsScheduleMatch } from './game.schedule-match.js';

/**
 * Every mechanic the base game plays with, in the order they are applied.
 *
 * Mechanics take no options: what used to be a factory argument is now a rule,
 * so the whole of a tuned game is the `Rules` the ruleset carries.
 */
const createGameMechanics = () => [
  gameMechanicsCreateMap,
  gameMechanicsPlaceCharger,
  gameMechanicsScheduleMatch,
  gameMechanicsAdvanceRound,
  ...userMechanics,
  ...androidMechanics,
  ...constructionMechanics,
  gameMechanicsExtractResources,
  gameMechanicsProcessResources,
  gameMechanicsRevealTiles,
  gameMechanicsDamageAcid,
  gameMechanicsDecayAndroids,
  gameMechanicsDestroyAndroids,
];

const gameMechanics = createGameMechanics();

export { createGameMechanics, gameMechanics };
