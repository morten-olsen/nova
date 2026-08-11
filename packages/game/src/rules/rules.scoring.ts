import { z } from 'zod';

import type { BuildingType } from '../schemas/schemas.building.js';
import type { MaterialBundle } from '../schemas/schemas.resources.js';

/**
 * One line in the readiness breakdown.
 *
 * `points: 0` keeps the contributor out of the breakdown entirely rather than
 * showing a row worth nothing, which is how the sight and communication
 * buildings stay unscored while still being nameable.
 */
const scoreRulesSchema = z.object({
  points: z.number(),
  label: z.string(),
});

type ScoreRules = z.infer<typeof scoreRulesSchema>;

const buildingScoreRulesSchema = z.object({
  charger: scoreRulesSchema.prefault({ points: 25, label: 'Power and Android capacity' }),
  'relay-tower': scoreRulesSchema.prefault({ points: 0, label: 'Communication relays' }),
  depot: scoreRulesSchema.prefault({ points: 40, label: 'Secured storage' }),
  extractor: scoreRulesSchema.prefault({ points: 80, label: 'Resource extraction' }),
  processor: scoreRulesSchema.prefault({ points: 100, label: 'Material processing' }),
  'acid-processing-plant': scoreRulesSchema.prefault({ points: 120, label: 'Environmental protection' }),
  scanner: scoreRulesSchema.prefault({ points: 0, label: 'Survey coverage' }),
  radar: scoreRulesSchema.prefault({ points: 0, label: 'Radar coverage' }),
  'colony-module': scoreRulesSchema.prefault({ points: 1_000, label: 'Colony modules' }),
} satisfies Record<BuildingType, z.ZodType<ScoreRules>>);

const materialScoreRulesSchema = z.object({
  metal: scoreRulesSchema.prefault({ points: 2, label: 'Stored metal' }),
  electronics: scoreRulesSchema.prefault({ points: 3, label: 'Stored electronics' }),
  polymer: scoreRulesSchema.prefault({ points: 3, label: 'Stored polymer' }),
  ore: scoreRulesSchema.prefault({ points: 1, label: 'Stored ore' }),
  water: scoreRulesSchema.prefault({ points: 2, label: 'Stored water' }),
  acidCanister: scoreRulesSchema.prefault({ points: 2, label: 'Stored acid canisters' }),
} satisfies Record<keyof MaterialBundle, z.ZodType<ScoreRules>>);

/**
 * What colony readiness measures.
 *
 * Only completed buildings and the material secured inside them score, so these
 * two tables are the whole of it: exploration, cargo, loose material, scripts
 * and Androids are worth nothing by design, not by omission.
 */
const scoringRulesSchema = z.object({
  buildings: buildingScoreRulesSchema.prefault({}),
  materials: materialScoreRulesSchema.prefault({}),
});

type ScoringRules = z.infer<typeof scoringRulesSchema>;

export type { ScoreRules, ScoringRules };
export { buildingScoreRulesSchema, materialScoreRulesSchema, scoreRulesSchema, scoringRulesSchema };
