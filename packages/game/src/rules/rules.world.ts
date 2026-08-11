import { z } from 'zod';

import { tileCompositionSchema } from '../schemas/schemas.resources.js';

/**
 * One generated amount.
 *
 * Rolled once per tile: with probability `chance` the tile gets a whole number
 * drawn uniformly from `min` to `max` inclusive, and otherwise nothing. All
 * three fields are required, so a roll is tuned whole rather than half-inherited
 * from a default that belongs to a different material.
 */
const materialRollSchema = z.object({
  chance: z.number().min(0).max(1),
  min: z.int().min(0),
  max: z.int().min(0),
});

type MaterialRoll = z.infer<typeof materialRollSchema>;

/**
 * Loose material dropped by the pods that landed before the Androids.
 *
 * `chance` gates the tile as a whole — most ground is bare — and each material
 * is then rolled on its own. `metal` has `chance: 1` because a pod field that
 * contains no metal is not a pod field.
 */
const scatteredRulesSchema = z.object({
  chance: z.number().min(0).max(1).default(0.25),
  metal: materialRollSchema.prefault({ chance: 1, min: 1, max: 5 }),
  electronics: materialRollSchema.prefault({ chance: 0.2, min: 1, max: 1 }),
  polymer: materialRollSchema.prefault({ chance: 0.25, min: 1, max: 2 }),
});

type ScatteredRules = z.infer<typeof scatteredRulesSchema>;

/** What a freshly generated tile has in the ground and on the surface. */
const worldGenerationRulesSchema = z.object({
  ore: materialRollSchema.prefault({ chance: 0.55, min: 1, max: 6 }),
  water: materialRollSchema.prefault({ chance: 0.18, min: 1, max: 4 }),
  acid: materialRollSchema.prefault({ chance: 0.12, min: 1, max: 4 }),
  radiation: materialRollSchema.prefault({ chance: 0.08, min: 1, max: 3 }),
  scattered: scatteredRulesSchema.prefault({}),
});

type WorldGenerationRules = z.infer<typeof worldGenerationRulesSchema>;

const worldRulesSchema = z.object({
  width: z.int().min(1).default(16),
  height: z.int().min(1).default(16),
  /**
   * Gives every tile the same composition and no scattered material, which is
   * how a test or a scenario gets a board it can reason about. `null` generates
   * from {@link worldGenerationRulesSchema} instead.
   *
   * Loose rather than strict, so a hand-authored composition carrying a field
   * the current tile schema does not know about survives the round trip instead
   * of being quietly dropped.
   */
  composition: tileCompositionSchema.loose().nullable().default(null),
  generation: worldGenerationRulesSchema.prefault({}),
});

type WorldRules = z.infer<typeof worldRulesSchema>;

export type { MaterialRoll, ScatteredRules, WorldGenerationRules, WorldRules };
export { materialRollSchema, scatteredRulesSchema, worldGenerationRulesSchema, worldRulesSchema };
