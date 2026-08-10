import type { World } from '../schemas/schemas.world.js';

const redactedValue = '[Redacted]';

const positionKey = ({ x, y }: { x: number; y: number }): string => `${x},${y}`;

/** Returns the information available to one android's script. */
const projectWorldForAndroid = (world: World, androidId: string): World => {
  const android = world.androids.find((candidate) => candidate.id === androidId);
  if (!android) {
    throw new Error(`Unknown android: ${androidId}`);
  }

  const visiblePositions = new Set(
    world.tiles
      .filter(
        (tile) =>
          tile.revealedBy?.includes(android.ownerId) || positionKey(tile.position) === positionKey(android.position),
      )
      .map((tile) => positionKey(tile.position)),
  );
  const isVisible = ({ position }: { position: { x: number; y: number } }): boolean =>
    visiblePositions.has(positionKey(position));

  return structuredClone({
    ...world,
    scripts: world.scripts.filter((script) => script.ownerId === android.ownerId),
    tiles: world.tiles.filter((tile) => isVisible(tile)),
    androids: world.androids.filter(isVisible).map((candidate) => ({
      ...candidate,
      ...(candidate.id === androidId ? {} : { memory: redactedValue, recording: redactedValue }),
    })),
    buildings: world.buildings.filter(isVisible),
    players: world.players?.filter((player) => player.id === android.ownerId),
    messages: world.messages?.filter(isVisible),
  });
};

export { projectWorldForAndroid, redactedValue };
