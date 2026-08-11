import type { Mechanic } from '../mechanics.base.js';

/**
 * Destroyed Androids are deactivated, not deleted.
 *
 * Deactivation is what takes them out of play — they take no turns and no longer
 * hold charger capacity — so the wreck can stay in the world, where its owner
 * can still read the `recording` it left behind and a replay can still inspect
 * it. Renderers are expected to leave inactive Androids off the board.
 */
const gameMechanicsDestroyAndroids: Mechanic = {
  name: 'game.destroy-androids',
  apply: ({ world, event }) => {
    if (event.type !== 'game.round-end') {
      return;
    }

    for (const android of world.androids) {
      if (!android.active || (android.health > 0 && android.battery > 0)) {
        continue;
      }

      android.active = false;
      // Floors whatever ran out, so a wreck reads as empty rather than negative.
      android.health = Math.max(0, android.health);
      android.battery = Math.max(0, android.battery);
    }
  },
};

export { gameMechanicsDestroyAndroids };
