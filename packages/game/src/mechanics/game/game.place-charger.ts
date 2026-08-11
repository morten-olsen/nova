import { placeInitialCharger } from '../../utils/utils.starter-position.js';
import type { Mechanic } from '../mechanics.base.js';

/**
 * Hands every player seeded into the world their guaranteed initial charger.
 *
 * A player created later — by their first upload, the way the single-player
 * commands do it — is given theirs by `ensurePlayer`, from the same list of
 * starting tiles.
 */
const gameMechanicsPlaceCharger: Mechanic = {
  name: 'game.place-charger',
  setup: ({ world, rules }) => {
    for (const player of world.players ?? []) {
      placeInitialCharger(world, player.id, rules);
    }
  },
};

export { gameMechanicsPlaceCharger };
