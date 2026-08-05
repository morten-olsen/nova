import { androidMechanics } from '../android/android.js';
import { constructionMechanics } from '../construction/construction.js';
import { userMechanics } from '../user/user.js';

import { gameMechanicsAdvanceRound } from './game.advance-round.js';
import { createGameMechanicsCreateMap, type CreateMapOptions } from './game.create-map.js';
import { gameMechanicsDamageAcid } from './game.damage-acid.js';
import { gameMechanicsDecayAndroids } from './game.decay-androids.js';
import { gameMechanicsDestroyAndroids } from './game.destroy-androids.js';
import { gameMechanicsExtractResources } from './game.extract-resources.js';
import { gameMechanicsPlaceCharger } from './game.place-charger.js';
import { gameMechanicsProcessResources } from './game.process-resources.js';
import { gameMechanicsRevealTiles } from './game.reveal-tiles.js';

type GameMechanicsOptions = {
  world?: CreateMapOptions;
};

const createGameMechanics = (options: GameMechanicsOptions = {}) => [
  createGameMechanicsCreateMap(options.world),
  gameMechanicsPlaceCharger,
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

export type { GameMechanicsOptions };
export { createGameMechanics, gameMechanics };
