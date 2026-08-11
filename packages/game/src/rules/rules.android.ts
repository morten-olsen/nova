import { z } from 'zod';

import { sightRulesSchema } from './rules.sight.js';

/**
 * Everything an Android is, numerically.
 *
 * Battery and health are the two clocks a script plays against, so every value
 * that moves either of them lives here — including the ones a script used to
 * have to hardcode, such as {@link cargoCapacity}.
 */
const androidRulesSchema = z.object({
  /** Total material units an Android can carry at once. */
  cargoCapacity: z.number().min(0).default(10),
  batteryCapacity: z.number().min(0).default(100),
  startingBattery: z.number().min(0).default(100),
  startingHealth: z.number().min(0).default(100),
  /** Battery spent moving one tile. */
  moveBatteryCost: z.number().min(0).default(1),
  /** Battery spent cleaning one adjacent tile. */
  cleanAcidBatteryCost: z.number().min(0).default(1),
  /** Acid removed from the target tile, and canisters banked, per clean. */
  cleanAcidAmount: z.number().min(0).default(1),
  /** Health every active Android loses at round end, hazards aside. */
  decayPerRound: z.number().min(0).default(0.1),
  /** Health lost per point of radiation in the ground under an Android. */
  radiationDamagePerPoint: z.number().min(0).default(0.25),
  /** Health lost per point of acid in the ground under an Android. */
  acidDamagePerPoint: z.number().min(0).default(0.5),
  /**
   * Health lost by an Android whose turn was refused.
   *
   * A failed turn is a script bug, not a death sentence: it costs the round and
   * some durability, so a script that keeps making the same mistake still wears
   * its Android down, but one bad edge case no longer ends the run.
   */
  failedTurnHealthPenalty: z.number().min(0).default(10),
  /** What an active Android reveals around itself, every round. */
  sight: sightRulesSchema.prefault({ range: 2, shape: 'stepped' }),
  /** Characters an Android may hold in its private `memory`. */
  memoryLimit: z.int().min(0).default(4_096),
  /** Characters an Android may hold in its player-facing `recording`. */
  recordingLimit: z.int().min(0).default(16_384),
  /** Characters one broadcast may carry. */
  broadcastLimit: z.int().min(0).default(256),
});

type AndroidRules = z.infer<typeof androidRulesSchema>;

export type { AndroidRules };
export { androidRulesSchema };
