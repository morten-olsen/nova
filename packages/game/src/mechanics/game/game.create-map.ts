import type { Tile } from '../../schemas/schemas.tile.js';
import type { Mechanic } from '../mechanics.base.js';

type CreateMapOptions = {
  width?: number;
  height?: number;
  composition?: Tile['composition'];
};

const randomInt = (maxInclusive: number): number => Math.floor(Math.random() * (maxInclusive + 1));

const randomTileComposition = (): Tile['composition'] => {
  const hasOre = Math.random() < 0.55;
  const hasWater = Math.random() < 0.18;
  const hasAcid = Math.random() < 0.12;
  const hasRadiation = Math.random() < 0.08;

  return {
    ore: hasOre ? 1 + randomInt(5) : 0,
    water: hasWater ? 1 + randomInt(3) : 0,
    acid: hasAcid ? 1 + randomInt(3) : 0,
    radiation: hasRadiation ? 1 + randomInt(2) : 0,
  };
};

const randomScatteredMaterial = (): Tile['scattered'] => {
  if (Math.random() >= 0.25) {
    return { metal: 0 };
  }

  return {
    metal: 1 + randomInt(4),
    electronics: Math.random() < 0.2 ? 1 : 0,
    polymer: Math.random() < 0.25 ? 1 + randomInt(1) : 0,
  };
};

const createGameMechanicsCreateMap = (options: CreateMapOptions = {}): Mechanic => ({
  name: 'game.create-map',
  setup: ({ world }) => {
    if (world.tiles.length > 0) {
      return;
    }

    const width = options.width ?? 16;
    const height = options.height ?? 16;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const tile: Tile = {
          position: { x, y },
          composition: options.composition ? { ...options.composition } : randomTileComposition(),
          scattered: options.composition ? undefined : randomScatteredMaterial(),
        };
        world.tiles.push(tile);
      }
    }
  },
});

export type { CreateMapOptions };
export { createGameMechanicsCreateMap };
