import { z } from 'zod';

import type { Building, BuildingType } from '../schemas/schemas.building.js';
import { materialKeys, type MaterialBundle } from '../schemas/schemas.resources.js';
import type { World } from '../schemas/schemas.world.js';

const scoreContributorSchema = z.object({
  id: z.string(),
  label: z.string(),
  quantity: z.number(),
  points: z.number(),
});

type ScoreContributor = z.infer<typeof scoreContributorSchema>;

const playerScoreSchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  total: z.number(),
  contributors: scoreContributorSchema.array(),
});

type PlayerScore = z.infer<typeof playerScoreSchema>;

type BuildingScore = {
  label: string;
  points: number;
};

const buildingScores: Partial<Record<BuildingType, BuildingScore>> = {
  charger: { label: 'Power and Android capacity', points: 25 },
  depot: { label: 'Secured storage', points: 40 },
  extractor: { label: 'Resource extraction', points: 80 },
  processor: { label: 'Material processing', points: 100 },
  'acid-processing-plant': { label: 'Environmental protection', points: 120 },
  'colony-module': { label: 'Colony modules', points: 1_000 },
};

const materialScores: Record<keyof MaterialBundle, BuildingScore> = {
  metal: { label: 'Stored metal', points: 2 },
  electronics: { label: 'Stored electronics', points: 3 },
  polymer: { label: 'Stored polymer', points: 3 },
  ore: { label: 'Stored ore', points: 1 },
  water: { label: 'Stored water', points: 2 },
  acidCanister: { label: 'Stored acid canisters', points: 2 },
};

const isComplete = (building: Building): boolean => building.remainingConstruction.ticks === 0;

const addContributor = (contributors: Map<string, ScoreContributor>, score: BuildingScore, quantity: number): void => {
  if (quantity <= 0) {
    return;
  }

  const existing = contributors.get(score.label);
  if (existing) {
    existing.quantity += quantity;
    existing.points += quantity * score.points;
    return;
  }

  contributors.set(score.label, {
    id: score.label.toLowerCase().replaceAll(' ', '-'),
    label: score.label,
    quantity,
    points: quantity * score.points,
  });
};

const playerIds = (world: World): string[] => {
  const ids = new Set(world.players?.map((player) => player.id));
  for (const building of world.buildings) {
    ids.add(building.ownerId);
  }
  for (const android of world.androids) {
    ids.add(android.ownerId);
  }
  return [...ids];
};

/**
 * Measures present colony readiness. Only completed, functioning infrastructure
 * and materials safely held in that infrastructure count; exploration, scripts,
 * broadcasts, loose materials, and Androids do not.
 */
const calculateColonyScores = (world: World): PlayerScore[] => {
  const names = new Map(world.players?.map((player) => [player.id, player.name]));

  return playerIds(world)
    .map((playerId) => {
      const contributors = new Map<string, ScoreContributor>();
      for (const building of world.buildings) {
        if (building.ownerId !== playerId || !isComplete(building)) {
          continue;
        }

        const buildingScore = buildingScores[building.type];
        if (buildingScore) {
          addContributor(contributors, buildingScore, 1);
        }

        for (const material of materialKeys) {
          addContributor(contributors, materialScores[material], building.storage?.[material] ?? 0);
        }
      }

      const breakdown = [...contributors.values()].sort((left, right) => right.points - left.points);
      return {
        playerId,
        playerName: names.get(playerId) ?? playerId,
        total: breakdown.reduce((total, contributor) => total + contributor.points, 0),
        contributors: breakdown,
      };
    })
    .sort((left, right) => right.total - left.total || left.playerName.localeCompare(right.playerName));
};

const colonyScoresSchema = playerScoreSchema.array();

export type { PlayerScore, ScoreContributor };
export { calculateColonyScores, colonyScoresSchema, playerScoreSchema, scoreContributorSchema };
