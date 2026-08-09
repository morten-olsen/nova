import type { World } from '../nova-game.browser.js';

const getWorldSize = (world: World) => {
  const { tiles } = world;
  const width = tiles.reduce((acc, tile) => Math.max(acc, tile.position.x), 0) + 1;
  const height = tiles.reduce((acc, tile) => Math.max(acc, tile.position.y), 0) + 1;
  return { width, height };
};

export { getWorldSize };
