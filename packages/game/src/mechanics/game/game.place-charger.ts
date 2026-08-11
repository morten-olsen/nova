import type { Position } from '../../schemas/schemas.base.js';
import { getWorldSize } from '../../utils/utils.world.js';
import type { Mechanic } from '../mechanics.base.js';

const positionKey = (position: Position): string => `${position.x},${position.y}`;

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

const uniquePositions = (positions: Position[]): Position[] => {
  const seen = new Set<string>();
  return positions.filter((position) => {
    const key = positionKey(position);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const gameMechanicsPlaceCharger: Mechanic = {
  name: 'game.place-charger',
  setup: ({ world, rules }) => {
    const players = world.players ?? [];
    const { width, height } = getWorldSize(world);
    const candidatePositions = uniquePositions([...starterPositions(width, height), ...mapPositions(width, height)]);
    const occupiedPositions = new Set(world.buildings.map((building) => positionKey(building.position)));

    players.forEach((player) => {
      const hasCharger = world.buildings.some(
        (building) => building.ownerId === player.id && building.type === 'charger',
      );
      if (hasCharger) {
        return;
      }

      const position = candidatePositions.find((candidate) => !occupiedPositions.has(positionKey(candidate)));
      if (!position) {
        throw new Error(`No open tile available for initial charger: ${player.id}`);
      }

      occupiedPositions.add(positionKey(position));
      world.buildings.push({
        id: `building-${world.buildings.length + 1}`,
        ownerId: player.id,
        type: 'charger',
        position,
        health: rules.buildings.charger.health,
        initial: true,
        remainingConstruction: {
          ticks: 0,
          resources: { metal: 0 },
        },
      });
    });
  },
};

export { gameMechanicsPlaceCharger };
