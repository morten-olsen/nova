import { z } from 'zod';

/**
 * How a sight range is measured.
 *
 * `stepped` counts orthogonal steps, so its footprint is a diamond: it is the
 * range an Android could actually walk, which is what makes short-range sight
 * feel like the piece looking around itself.
 *
 * `circular` is true Euclidean distance, so its footprint is a disc. A radar
 * sweeps, it does not walk, and at radius 5 a diamond would look like an
 * obvious lozenge on the board rather than a sweep.
 */
const sightShapeSchema = z.enum(['stepped', 'circular']);

type SightShape = z.infer<typeof sightShapeSchema>;

/**
 * What one sight source can see.
 *
 * Both fields are required, deliberately: a sight rule is supplied whole or not
 * at all, so raising a radar's range cannot silently turn its disc into a
 * diamond by inheriting the shape default.
 */
const sightRulesSchema = z.object({
  range: z.number().min(0),
  shape: sightShapeSchema,
});

type SightRules = z.infer<typeof sightRulesSchema>;

export type { SightRules, SightShape };
export { sightRulesSchema, sightShapeSchema };
