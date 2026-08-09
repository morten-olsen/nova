import type { Mechanic } from '../mechanics.base.js';

const gameMechanicsDestroyAndroids: Mechanic = {
  name: 'game.destroy-androids',
  apply: ({ world, event }) => {
    if (event.type !== 'game.round-end') {
      return;
    }
    world.androids = world.androids.filter((android) => android.health > 0 && android.battery > 0);
  },
};

export { gameMechanicsDestroyAndroids };
