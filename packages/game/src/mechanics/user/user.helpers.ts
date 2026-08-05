import type { Position } from '../../schemas/schemas.base.js';
import type { World } from '../../schemas/schemas.world.js';

const firstOpenTilePosition = (world: World): Position => {
  const occupied = new Set(world.buildings.map((building) => `${building.position.x},${building.position.y}`));
  return world.tiles.find((tile) => !occupied.has(`${tile.position.x},${tile.position.y}`))?.position ?? { x: 0, y: 0 };
};

const ensureWorldCollections = (world: World): void => {
  world.players ??= [];
  world.messages ??= [];
  world.round ??= 0;
};

const ensurePlayer = (world: World, ownerId: string): void => {
  ensureWorldCollections(world);

  const players = world.players ?? [];
  world.players = players;

  if (!players.some((player) => player.id === ownerId)) {
    players.push({ id: ownerId, name: ownerId });
  }

  const hasCharger = world.buildings.some((building) => building.ownerId === ownerId && building.type === 'charger');
  if (hasCharger) {
    return;
  }

  world.buildings.push({
    id: `building-${world.buildings.length + 1}`,
    ownerId,
    type: 'charger',
    position: { ...firstOpenTilePosition(world) },
    health: 100,
    initial: true,
    remainingConstruction: { ticks: 0, resources: { metal: 0 } },
  });
};

export { ensurePlayer, ensureWorldCollections };
