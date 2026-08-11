import type { Mechanic } from '../mechanics.base.js';

const gameMechanicsDecayAndroids: Mechanic = {
  name: 'game.decay-androids',
  apply: ({ world, event, rules }) => {
    if (event.type !== 'game.round-end') {
      return;
    }

    for (const android of world.androids) {
      // A wreck stays in the world, but it is past decaying any further.
      if (!android.active) {
        continue;
      }

      const tile = world.tiles.find(
        (candidate) => candidate.position.x === android.position.x && candidate.position.y === android.position.y,
      );
      const radiation = tile?.composition.radiation ?? 0;

      android.health -= rules.android.decayPerRound + radiation * rules.android.radiationDamagePerPoint;
    }
  },
};

export { gameMechanicsDecayAndroids };
