import type { Mechanic } from '../mechanics.base.js';

const gameMechanicsAdvanceRound: Mechanic = {
  name: 'game.advance-round',
  apply: ({ world, event }) => {
    if (event.type !== 'game.round-start') {
      return;
    }

    world.round = (world.round ?? 0) + 1;
  },
};

export { gameMechanicsAdvanceRound };
