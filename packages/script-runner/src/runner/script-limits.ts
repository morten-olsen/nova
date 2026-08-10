/**
 * What a single android turn is allowed to consume.
 *
 * Every limit is per turn rather than per match: the sandbox builds a fresh
 * QuickJS runtime for each script and throws it away afterwards, so a script
 * that spends its whole memory budget hands none of that debt to the next
 * android.
 */
type ScriptLimits = {
  /**
   * CPU budget, counted in interrupt ticks rather than milliseconds.
   *
   * QuickJS calls its interrupt handler every ~10k bytecode operations, so this
   * is a machine-independent instruction budget: the same script interrupted on
   * a slow laptop is interrupted at the same point on a fast one. That matters
   * for peer matches, where both sides replay the same turn and must agree on
   * where a runaway script stopped. {@link timeoutMs} is the backstop for work
   * that burns wall clock without burning ticks, and is *not* deterministic.
   */
  fuel?: number;
  /** Wall-clock backstop, in milliseconds. */
  timeoutMs?: number;
  /** Heap ceiling for the turn's runtime, in bytes. */
  memoryBytes?: number;
  /**
   * Call-stack ceiling, in bytes. Caps runaway recursion.
   *
   * Silently clamped to {@link maxStackBytes}; see that constant for why a
   * larger value is not merely ignored but actively dangerous.
   */
  stackBytes?: number;
};

type ResolvedScriptLimits = Required<ScriptLimits>;

/**
 * The largest QuickJS stack that is still safely *inside* the WebAssembly
 * module's own stack.
 *
 * This one is not a policy choice, it is a hard property of the build. QuickJS
 * checks recursion against its configured limit, but each JS frame is also a
 * real wasm frame; if the configured limit is the larger of the two, unbounded
 * recursion blows the wasm stack first. That is not a catchable script error —
 * it aborts the whole module, taking every future turn in the process with it.
 * Measured on both the quickjs-ng and bellard builds: 256KiB reports a clean
 * `stack overflow` to the script, 320KiB kills the module.
 *
 * The default sits well under the boundary rather than on it, because the
 * measurement was taken in one JS engine and the frames it counts are the host
 * engine's.
 */
const maxStackBytes = 256 * 1024;

/**
 * The two CPU defaults are picked together, and the ordering between them is
 * the point: `fuel` should be what actually stops a runaway script, with
 * `timeoutMs` reached only on a machine far slower than any it was measured on.
 * A turn cut short by the tick budget stops at the same instruction everywhere,
 * so two peers replaying the same match agree on the result; a turn cut short
 * by the clock does not, and is a divergence waiting to happen.
 *
 * `bench/turn-cost.ts` measures 2000 ticks at ~43ms of flat-out spinning, so
 * 10k ticks is roughly a fifth of a second of real CPU here and still under the
 * one-second backstop on a machine three times slower. Legitimate bots are
 * nowhere near it: the shipped starter bot finishes a turn on a 400-tile map
 * without spending a single tick.
 */
const defaultLimits: ResolvedScriptLimits = {
  fuel: 10_000,
  timeoutMs: 1_000,
  memoryBytes: 16 * 1024 * 1024,
  stackBytes: 128 * 1024,
};

const resolveLimits = (limits: ScriptLimits = {}): ResolvedScriptLimits => ({
  fuel: limits.fuel ?? defaultLimits.fuel,
  timeoutMs: limits.timeoutMs ?? defaultLimits.timeoutMs,
  memoryBytes: limits.memoryBytes ?? defaultLimits.memoryBytes,
  stackBytes: Math.min(limits.stackBytes ?? defaultLimits.stackBytes, maxStackBytes),
});

export type { ResolvedScriptLimits, ScriptLimits };
export { defaultLimits, maxStackBytes, resolveLimits };
