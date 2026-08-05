import type { Mechanic } from '../mechanics.base.js';

const gameMechanicsDamageAcid: Mechanic = {
  name: 'game.damage-acid',
  apply: ({ world, event }) => {
    if (event.type !== 'game.round-end') {
      return;
    }

    for (const android of world.androids) {
      const tile = world.tiles.find(
        (candidate) => candidate.position.x === android.position.x && candidate.position.y === android.position.y,
      );
      const acid = tile?.composition.acid ?? 0;
      if (acid > 0) {
        android.health -= acid * 0.5;
      }
    }
  },
};

export { gameMechanicsDamageAcid };
