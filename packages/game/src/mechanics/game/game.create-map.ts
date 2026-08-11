import type { MaterialRoll, ScatteredRules, WorldGenerationRules } from '../../rules/rules.world.js';
import type { Tile } from '../../schemas/schemas.tile.js';
import type { Mechanic } from '../mechanics.base.js';

/** One roll of a generation rule: nothing, or a whole number in its range. */
const roll = ({ chance, min, max }: MaterialRoll): number => {
  if (Math.random() >= chance) {
    return 0;
  }

  return min + Math.floor(Math.random() * (Math.max(min, max) - min + 1));
};

const randomTileComposition = (generation: WorldGenerationRules): Tile['composition'] => ({
  ore: roll(generation.ore),
  water: roll(generation.water),
  acid: roll(generation.acid),
  radiation: roll(generation.radiation),
});

const randomScatteredMaterial = (scattered: ScatteredRules): Tile['scattered'] => {
  // The tile is gated first, so most ground is bare rather than every tile
  // holding a little of everything.
  if (Math.random() >= scattered.chance) {
    return { metal: 0 };
  }

  return {
    metal: roll(scattered.metal),
    electronics: roll(scattered.electronics),
    polymer: roll(scattered.polymer),
  };
};

const gameMechanicsCreateMap: Mechanic = {
  name: 'game.create-map',
  setup: ({ world, rules }) => {
    if (world.tiles.length > 0) {
      return;
    }

    const { width, height, composition, generation } = rules.world;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const tile: Tile = {
          position: { x, y },
          composition: composition ? { ...composition } : randomTileComposition(generation),
          scattered: composition ? undefined : randomScatteredMaterial(generation.scattered),
        };
        world.tiles.push(tile);
      }
    }
  },
};

export { gameMechanicsCreateMap };
