import { z } from 'zod';

import { defaultRules, type Rules } from '../rules/rules.js';
import type { ScoreRules } from '../rules/rules.scoring.js';
import type { Building } from '../schemas/schemas.building.js';
import { materialKeys } from '../schemas/schemas.resources.js';
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

const isComplete = (building: Building): boolean => building.remainingConstruction.ticks === 0;

const addContributor = (contributors: Map<string, ScoreContributor>, score: ScoreRules, quantity: number): void => {
  // A rule worth no points earns no row: that is how the sight and
  // communication buildings stay named but unscored.
  if (quantity <= 0 || score.points === 0) {
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
 *
 * `rules` decides what anything is worth. It defaults to the shipped game so a
 * caller holding nothing but a world — a renderer, a scoreboard — still gets an
 * answer; a caller with a recording should pass `recording.rules`, because a
 * match tuned for different stakes was not scored by this table.
 */
const calculateColonyScores = (world: World, rules: Rules = defaultRules): PlayerScore[] => {
  const names = new Map(world.players?.map((player) => [player.id, player.name]));
  const { buildings: buildingScores, materials: materialScores } = rules.scoring;

  return playerIds(world)
    .map((playerId) => {
      const contributors = new Map<string, ScoreContributor>();
      for (const building of world.buildings) {
        if (building.ownerId !== playerId || !isComplete(building)) {
          continue;
        }

        addContributor(contributors, buildingScores[building.type], 1);

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
