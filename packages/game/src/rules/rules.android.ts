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
  /**
   * Total material units an Android can carry at once.
   *
   * Twelve rather than ten because ten was exactly a charger, so any electronics
   * picked up on the way home made the one building that grows a fleet
   * unaffordable without a round trip through a depot. A hold has to be able to
   * carry the next building plus whatever it walked past.
   */
  cargoCapacity: z.number().min(0).default(12),
  batteryCapacity: z.number().min(0).default(100),
  startingBattery: z.number().min(0).default(100),
  startingHealth: z.number().min(0).default(100),
  /** Battery spent moving one tile. */
  moveBatteryCost: z.number().min(0).default(1),
  /** Battery spent cleaning one adjacent tile. */
  cleanAcidBatteryCost: z.number().min(0).default(1),
  /** Acid removed from the target tile, and canisters banked, per clean. */
  cleanAcidAmount: z.number().min(0).default(1),
  /**
   * Health every active Android loses at round end, hazards aside.
   *
   * An Android is a consumable, and this is the rate that makes it one: at 1.5 a
   * point a round it wears out after about sixty-five rounds of careful work, and
   * a good deal faster once acid, radiation and its own mistakes are counted. A
   * fleet is expected to lose members, replace them, and hand the new one a
   * better script — which is only survivable because a player with charger
   * capacity and no Androids gets one back (`match.replaceLostAndroids`).
   *
   * At the old 0.1 an Android lived a thousand rounds. Nothing about keeping one
   * alive was a decision, so nothing about losing one was either.
   */
  decayPerRound: z.number().min(0).default(1.5),
  /**
   * Health lost per point of radiation in the ground under an Android.
   *
   * Hazards used to be close to decoration: an Android could stand in the worst
   * acid on the board for eighty rounds, so nothing was gained by reading
   * `composition` before stepping. At these rates the same tile is lethal in
   * about a dozen rounds, which is what makes a route a decision.
   */
  radiationDamagePerPoint: z.number().min(0).default(0.75),
  /** Health lost per point of acid in the ground under an Android. */
  acidDamagePerPoint: z.number().min(0).default(1.5),
  /**
   * Health lost by an Android whose turn was refused.
   *
   * A failed turn is a script bug, not a death sentence: it costs the round and
   * some durability, so a script that keeps making the same mistake still wears
   * its Android down, but one bad edge case no longer ends the run.
   */
  failedTurnHealthPenalty: z.number().min(0).default(10),
  /** What an active Android reveals around itself, every round. */
  sight: sightRulesSchema.prefault({ range: 3, shape: 'stepped' }),
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
