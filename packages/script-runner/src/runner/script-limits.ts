import type { Rules } from '@morten-olsen/nova-game';

/**
 * What a single android turn is allowed to consume, as the sandbox wants it.
 *
 * Three of the four are game rules — `rules.script` — so a script can read its
 * own budget and a recording replays under the budget it was played with. The
 * fourth, {@link ScriptLimits.stackBytes}, is not a rule and must not become
 * one: it is a property of the WebAssembly build rather than a design knob. See
 * {@link maxStackBytes}.
 *
 * Every limit is per turn rather than per match: the sandbox builds a fresh
 * QuickJS runtime for each script and throws it away afterwards, so a script
 * that spends its whole memory budget hands none of that debt to the next
 * android.
 */
type ScriptLimits = {
  /** CPU budget in interrupt ticks. `rules.script.fuel`. */
  fuel: number;
  /** Wall-clock backstop, in milliseconds. `rules.script.timeoutMs`. */
  timeoutMs: number;
  /** Heap ceiling for the turn's runtime, in bytes. `rules.script.memoryBytes`. */
  memoryBytes: number;
  /** Call-stack ceiling, in bytes. Caps runaway recursion. */
  stackBytes: number;
};

/**
 * The largest QuickJS stack that is still safely *inside* the WebAssembly
 * module's own stack.
 *
 * This one is not a policy choice, it is a hard property of the build, which is
 * why it is not exposed as a rule. QuickJS checks recursion against its
 * configured limit, but each JS frame is also a real wasm frame; if the
 * configured limit is the larger of the two, unbounded recursion blows the wasm
 * stack first. That is not a catchable script error — it aborts the whole
 * module, taking every future turn in the process with it. Measured on both the
 * quickjs-ng and bellard builds: 256KiB reports a clean `stack overflow` to the
 * script, 320KiB kills the module.
 *
 * The default sits well under the boundary rather than on it, because the
 * measurement was taken in one JS engine and the frames it counts are the host
 * engine's.
 */
const maxStackBytes = 256 * 1024;

const defaultStackBytes = 128 * 1024;

/**
 * Reads a turn's limits off the rules the loop is already handing every script.
 *
 * Cheap enough to do per turn — three field reads and a `Math.min` — which is
 * what keeps the runner a plain `ScriptRunner` rather than something a host has
 * to construct once per game with the right numbers.
 */
const resolveLimits = (rules: Rules, stackBytes: number = defaultStackBytes): ScriptLimits => ({
  fuel: rules.script.fuel,
  timeoutMs: rules.script.timeoutMs,
  memoryBytes: rules.script.memoryBytes,
  // Clamped rather than rejected: this is a host option, and the failure it
  // prevents is not one the host would be able to diagnose.
  stackBytes: Math.min(stackBytes, maxStackBytes),
});

export type { ScriptLimits };
export { defaultStackBytes, maxStackBytes, resolveLimits };
