import { z } from 'zod';

/**
 * What one android turn is allowed to consume.
 *
 * Rules rather than host configuration for the same reason every other number
 * here is a rule: a script is entitled to know the game it is playing. A bot
 * that plans a flood fill should be able to ask how much room it has instead of
 * discovering the answer by failing a turn, and a recording should replay under
 * the budgets it was played with rather than under whichever ones the machine
 * replaying it happens to prefer.
 *
 * Per turn, not per match. The sandbox builds an interpreter for each script and
 * throws it away afterwards, so a script that spends its whole allowance hands
 * none of that debt to the next android.
 *
 * Every value has a ceiling as well as a default. A rules file is data, and one
 * arriving from a peer or a downloaded game should not be able to ask a host for
 * a minute of wall clock and a gigabyte of heap per android per round.
 */
const scriptRulesSchema = z.object({
  /**
   * CPU budget, counted in interpreter ticks rather than milliseconds.
   *
   * The reference sandbox interrupts a script every ~10k bytecode operations, so
   * this is a machine-independent instruction budget: the same script is cut off
   * at the same point on a slow laptop and a fast one. That is what lets two
   * peers replay a match and agree on where a runaway script stopped.
   * {@link timeoutMs} is the backstop for work that burns wall clock without
   * burning ticks, and is *not* deterministic.
   *
   * `bench/turn-cost.ts` in the script-runner package measures 2000 ticks at
   * ~43ms of flat-out spinning, so the default is roughly a fifth of a second of
   * real CPU and still inside the one-second backstop on a machine three times
   * slower. Legitimate bots are nowhere near it: the shipped starter builder
   * finishes a turn on a 400-tile map without spending a single tick.
   */
  fuel: z.int().min(100).max(10_000_000).default(10_000),
  /**
   * Wall-clock backstop, in milliseconds.
   *
   * Deliberately looser than {@link fuel}: this one should only ever fire for
   * work that is slow without being long — allocating hard enough to thrash the
   * collector — because a turn cut short by the clock stops in a different place
   * on every machine, and two peers that disagree about where are two peers with
   * different worlds.
   */
  timeoutMs: z.int().min(10).max(60_000).default(1_000),
  /** Heap ceiling for the turn's interpreter, in bytes. */
  memoryBytes: z
    .int()
    .min(1024 * 1024)
    .max(512 * 1024 * 1024)
    .default(16 * 1024 * 1024),
});

type ScriptRules = z.infer<typeof scriptRulesSchema>;

export type { ScriptRules };
export { scriptRulesSchema };
