import { androidCapacityForOwner, launchAndroid } from '../android/android.helpers.js';
import type { Mechanic } from '../mechanics.base.js';

/**
 * Sends a replacement to a player who has no Androids left.
 *
 * Androids are meant to be lost. They decay, hazards eat them, and a script with
 * a bad edge case wears one out — and a strategy that cannot afford to lose one
 * is a strategy that never leaves the charger. But a match launches one Android
 * per player and there is nobody at the controls afterwards, so without this the
 * first fatal mistake is not a setback, it is elimination: a player with a single
 * charger whose Android dies on round nine watches the remaining rounds.
 *
 * What it costs is real without being final — the round it died, the cargo it was
 * carrying, and the walk back out to wherever it had got to. Capacity still
 * decides everything: the replacement needs a completed charger to arrive at, so
 * a player whose chargers have all been salvaged stays gone, and chargers are
 * insurance as much as they are expansion.
 *
 * A host that wants attrition to be permanent sets `match.replaceLostAndroids`
 * to false and gets an elimination game instead.
 */
const gameMechanicsReplaceLostAndroids: Mechanic = {
  name: 'game.replace-lost-androids',
  apply: ({ world, event, rules }) => {
    if (event.type !== 'game.round-start' || !rules.match.replaceLostAndroids) {
      return;
    }

    for (const player of world.players ?? []) {
      const active = world.androids.filter((android) => android.ownerId === player.id && android.active);
      if (active.length > 0 || androidCapacityForOwner(world, player.id, rules) < 1) {
        continue;
      }

      // The newest script they uploaded, because a player who has been improving
      // their Android should not be sent back out with their first attempt.
      const script = [...world.scripts].reverse().find((candidate) => candidate.ownerId === player.id);
      if (!script) {
        continue;
      }

      launchAndroid({ world, ownerId: player.id, scriptId: script.id, rules });
    }
  },
};

export { gameMechanicsReplaceLostAndroids };
