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
  /**
   * How much of the ground holds a pod at all.
   *
   * Density rather than volume is what this controls, and the two were confused
   * once already: thinning the pods out to shrink the loose pool pushed the share
   * of turns spent walking from 44% to 72%, because a smaller pool spread over the
   * same ground is a longer trip between piles. The pool is kept small by making
   * piles *smaller* instead — see {@link metal} — and the pods stay close together.
   */
  chance: z.number().min(0).max(1).default(0.25),
  /**
   * Metal per pod: one to three, so a 12x12 board scatters around seventy.
   *
   * Sized against two things at once. At one to five the ground held three times
   * more than two or three Androids could pick up in a hundred rounds, so the
   * handover from scavenging to industry was never forced — a player chose it or
   * never bothered. At one to three it held barely more than the bootstrap chain
   * costs: a depot, a charger, an extractor and a processor come to thirty-six
   * metal, and half a board's seventy left nothing over for anything to go wrong.
   *
   * One to four is the middle: about ninety on a 12x12 board, forty-five a side,
   * enough to stand an industry up with room for one mistake — and gone by around
   * round forty, after which new metal comes out of the ground or not at all.
   */
  metal: materialRollSchema.prefault({ chance: 1, min: 1, max: 4 }),
  /**
   * Electronics: enough to *start* an industry, never enough to skip one.
   *
   * One per pod, so around eighteen on a 12x12 board and nine a side. An extractor
   * and a processor cost five between them, which leaves room for a mistake — and
   * leaves a colony module's twenty firmly out of reach of the ground. Thinning the
   * pods once left only six on a whole board, and two players sharing six meant one
   * could simply never bootstrap, which is a deadlock rather than a decision.
   */
  electronics: materialRollSchema.prefault({ chance: 0.5, min: 1, max: 1 }),
  /**
   * Polymer: none. Earth sent none, and the only polymer on the planet is polymer
   * a colony made.
   *
   * It is the one material that has to be manufactured, and it comes out of the
   * acid processing plant — so the colony module cannot be built by anyone who has
   * not cleaned up part of the planet first. That is the whole premise of the game
   * put into the cost of its winning piece, and it is why the processor and the
   * plant no longer cost polymer themselves: a refinery whose own price is its own
   * output can never be the first one built.
   *
   * Only one of the two refined materials can be withheld. Withhold both and
   * neither refinery can be built at all, because each costs the other's product.
   * Polymer is the one to withhold because electronics are what the *first*
   * industry building needs, and a bootstrap has to be findable.
   *
   * A host who wants the old scavenger economy back sets a chance above zero.
   */
  polymer: materialRollSchema.prefault({ chance: 0, min: 0, max: 0 }),
});

type ScatteredRules = z.infer<typeof scatteredRulesSchema>;

/** What a freshly generated tile has in the ground and on the surface. */
const worldGenerationRulesSchema = z.object({
  /**
   * Ore in the ground: rarer than it was, and richer where it is.
   *
   * At 55% of tiles holding one to six, good extractor ground was everywhere and
   * so worth nothing to find, scout for, or deny. A quarter of tiles holding three
   * to eight makes a rich tile a place on the map — the thing scanners are for,
   * and the thing two players can want at once.
   */
  ore: materialRollSchema.prefault({ chance: 0.25, min: 3, max: 8 }),
  water: materialRollSchema.prefault({ chance: 0.18, min: 1, max: 4 }),
  acid: materialRollSchema.prefault({ chance: 0.12, min: 1, max: 4 }),
  radiation: materialRollSchema.prefault({ chance: 0.08, min: 1, max: 3 }),
  scattered: scatteredRulesSchema.prefault({}),
});

type WorldGenerationRules = z.infer<typeof worldGenerationRulesSchema>;

const worldRulesSchema = z.object({
  /**
   * The board, 12x12 by default.
   *
   * Measured as the fairest size and the only real source of contact: two players
   * running the same script finish 3% apart here against 18% on a 16x16 board,
   * because they cover most of the ground rather than a quarter of it each. Below
   * 10x10 it gets noisy again — too few pods for any one of them to be unimportant.
   */
  width: z.int().min(1).default(12),
  height: z.int().min(1).default(12),
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
