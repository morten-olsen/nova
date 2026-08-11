import type { Rules } from '../rules/rules.js';
import type { Position } from '../schemas/schemas.base.js';
import type { World } from '../schemas/schemas.world.js';

import { getWorldSize } from './utils.world.js';

const positionKey = (position: Position): string => `${position.x},${position.y}`;

/**
 * Where a player would rather start: the corners, furthest apart first.
 *
 * Two players who start next to each other are two players scavenging the same
 * pods, and the ground either of them reaches first is ground the other one
 * loses. Opposite corners is what makes the map they were each handed roughly
 * the same map.
 */
const starterPositions = (width: number, height: number): Position[] => [
  { x: 0, y: 0 },
  { x: Math.max(0, width - 1), y: Math.max(0, height - 1) },
  { x: Math.max(0, width - 1), y: 0 },
  { x: 0, y: Math.max(0, height - 1) },
];

const mapPositions = (width: number, height: number): Position[] => {
  const positions: Position[] = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      positions.push({ x, y });
    }
  }

  return positions;
};

/** The best free starting tile left, preferring the corners over the scan order. */
const nextStarterPosition = (world: World): Position | undefined => {
  const { width, height } = getWorldSize(world);
  const occupied = new Set(world.buildings.map((building) => positionKey(building.position)));
  const seen = new Set<string>();
  return [...starterPositions(width, height), ...mapPositions(width, height)].find((candidate) => {
    const key = positionKey(candidate);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return !occupied.has(key);
  });
};

/**
 * Gives a player the initial charger they are guaranteed, if they have none.
 *
 * Shared by world setup and by the lazy player creation that a single-player
 * command relies on, because a player created by their first event is owed the
 * same start as one the host seeded up front. Placing them by scan order instead
 * put the second player's charger one tile from the first player's.
 */
const placeInitialCharger = (world: World, ownerId: string, rules: Rules): void => {
  const hasCharger = world.buildings.some((building) => building.ownerId === ownerId && building.type === 'charger');
  if (hasCharger) {
    return;
  }

  const position = nextStarterPosition(world);
  if (!position) {
    throw new Error(`No open tile available for initial charger: ${ownerId}`);
  }

  world.buildings.push({
    id: `building-${world.buildings.length + 1}`,
    ownerId,
    type: 'charger',
    position: { ...position },
    health: rules.buildings.charger.health,
    initial: true,
    remainingConstruction: {
      ticks: 0,
      resources: { metal: 0 },
    },
  });
};

export { nextStarterPosition, placeInitialCharger, starterPositions };
