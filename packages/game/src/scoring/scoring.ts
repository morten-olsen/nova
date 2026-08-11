import { z } from 'zod';

import { defaultRules, type Rules } from '../rules/rules.js';
import type { ScoreRules } from '../rules/rules.scoring.js';
import type { Building } from '../schemas/schemas.building.js';
import { materialKeys } from '../schemas/schemas.resources.js';
import type { World } from '../schemas/schemas.world.js';
import { isBuildingComplete } from '../utils/utils.building.js';

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

const addContributor = (
  contributors: Map<string, ScoreContributor>,
  score: ScoreRules,
  quantity: number,
  points: number,
): void => {
  // A rule worth no points earns no row: that is how the sight and
  // communication buildings stay named but unscored.
  if (quantity <= 0 || score.points === 0) {
    return;
  }

  const existing = contributors.get(score.label);
  if (existing) {
    existing.quantity += quantity;
    existing.points += points;
    return;
  }

  contributors.set(score.label, {
    id: score.label.toLowerCase().replaceAll(' ', '-'),
    label: score.label,
    quantity,
    points,
  });
};

/**
 * What the next building of a type is worth to a player who already has some.
 *
 * `diminishing` is applied per building rather than to the row, so the
 * breakdown's quantity stays the honest count and only its points bend.
 */
const buildingAward = (score: ScoreRules, alreadyCounted: number): number =>
  Math.round(score.points * score.diminishing ** alreadyCounted);

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
      const counted = new Map<Building['type'], number>();
      for (const building of world.buildings) {
        if (building.ownerId !== playerId || !isBuildingComplete(building)) {
          continue;
        }

        const score = buildingScores[building.type];
        const alreadyCounted = counted.get(building.type) ?? 0;
        counted.set(building.type, alreadyCounted + 1);
        addContributor(contributors, score, 1, buildingAward(score, alreadyCounted));

        for (const material of materialKeys) {
          const stored = building.storage?.[material] ?? 0;
          addContributor(contributors, materialScores[material], stored, stored * materialScores[material].points);
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
