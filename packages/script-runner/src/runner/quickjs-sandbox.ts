import { Scope, type QuickJSContext, type QuickJSHandle, type QuickJSWASMModule } from 'quickjs-emscripten-core';

import { resetQuickJs } from '../quickjs/quickjs-module.js';

import type { ScriptLimits } from './script-limits.js';

type SandboxInput = {
  androidId: string;
  content: string;
  /**
   * `JSON.stringify({ androidId, world, rules, turn, finalTurn })`, with the
   * world already fogged for this android.
   *
   * A string rather than the object because that is what makes the sandbox
   * cheap: one copy into WebAssembly memory and one `JSON.parse` inside the VM,
   * instead of walking the world tree property by property across the FFI
   * boundary. It is also exactly what a Worker wants to receive, so the
   * in-process and off-thread runners can share this shape.
   */
  inputJson: string;
  limits: ScriptLimits;
};

/**
 * Deliberately plain data: the Worker runner posts this across a thread
 * boundary unchanged, so nothing here may be a handle, a class, or an Error.
 */
type SandboxOutcome =
  { ok: true; actionJson: string | undefined } | { ok: false; message: string; stack: string | undefined };

/** Where the fogged world is parked before the bootstrap moves it into place. */
const inputGlobal = '__novaInput';

/**
 * Unpacks the turn's input into the bare globals the script contract promises,
 * then removes its own scaffolding so a script cannot find the unparsed payload
 * lying around.
 *
 * `finalTurn` is assigned unconditionally, so a match with no scheduled end
 * gives scripts a global that reads `undefined` rather than one that throws.
 */
const bootstrapSource = `(function () {
  var input = JSON.parse(${inputGlobal});
  globalThis.androidId = input.androidId;
  globalThis.world = input.world;
  globalThis.rules = input.rules;
  globalThis.turn = input.turn;
  globalThis.finalTurn = input.finalTurn;
  delete globalThis.${inputGlobal};
})()`;

type FailedOutcome = Extract<SandboxOutcome, { ok: false }>;

/** Turns a thrown VM value into a host-side message, and disposes the handle. */
const describeError = (context: QuickJSContext, error: QuickJSHandle): FailedOutcome => {
  const dumped: unknown = error.consume((handle) => context.dump(handle));

  if (typeof dumped !== 'object' || dumped === null) {
    return { ok: false, message: String(dumped), stack: undefined };
  }

  const { name, message, stack } = dumped as { name?: unknown; message?: unknown; stack?: unknown };
  const described = [name, message].filter((part) => typeof part === 'string' && part.length > 0).join(': ');

  return {
    ok: false,
    message: described.length > 0 ? described : JSON.stringify(dumped),
    stack: typeof stack === 'string' ? stack : undefined,
  };
};

/**
 * Serializes the script's completion value inside the VM.
 *
 * `context.dump` would also work, but it rebuilds the value handle by handle on
 * the host side; `JSON.stringify` runs in the interpreter and comes back as one
 * string. It also gives the same answer the browser's `postMessage` used to:
 * an action holding a function or a class instance fails here rather than
 * arriving half-formed.
 *
 * Returns `undefined` when the value is not serializable at all (`undefined`,
 * a function), which the caller reports through the engine's shared
 * "must end in an action object" error.
 */
const stringifyAction = (context: QuickJSContext, value: QuickJSHandle): string | undefined =>
  Scope.withScope((scope) => {
    const json = scope.manage(context.getProp(context.global, 'JSON'));
    const stringify = scope.manage(context.getProp(json, 'stringify'));
    const called = context.callFunction(stringify, json, value);

    if (called.error) {
      // Circular references and throwing getters land here.
      throw new Error(describeError(context, called.error).message);
    }

    const serialized = scope.manage(called.value);
    return context.typeof(serialized) === 'string' ? context.getString(serialized) : undefined;
  });

/**
 * Runs one script to completion under a set of hard resource ceilings.
 *
 * Synchronous by construction. The runtime is built, used, and destroyed within
 * this call, which is what makes {@link ScriptLimits} per-turn rather than
 * per-match — and it is affordable only because `module` carries the expensive
 * part (the instantiated WebAssembly) across every call.
 */
const runInSandbox = (module: QuickJSWASMModule, input: SandboxInput): SandboxOutcome => {
  try {
    return runInFreshRuntime(module, input);
  } catch (error) {
    // Nothing a script does is supposed to reach here: script errors come back
    // as outcomes, not exceptions. A throw means the WebAssembly module itself
    // gave up — a stack deep enough to exhaust the wasm stack is the one script
    // behaviour that can do it — and an aborted module never recovers. Drop it
    // so the next turn instantiates a fresh one.
    resetQuickJs();
    return {
      ok: false,
      message:
        `Script for ${input.androidId} crashed the sandbox and lost its turn ` +
        `(${error instanceof Error ? error.message : String(error)}). ` +
        'Deeply recursive scripts are the usual cause.',
      stack: undefined,
    };
  }
};

const runInFreshRuntime = (module: QuickJSWASMModule, input: SandboxInput): SandboxOutcome => {
  const { androidId, content, inputJson, limits } = input;

  let ticks = 0;
  let interruptedBy: 'fuel' | 'timeout' | undefined;
  const deadline = Date.now() + limits.timeoutMs;

  const runtime = module.newRuntime({
    memoryLimitBytes: limits.memoryBytes,
    maxStackSizeBytes: limits.stackBytes,
    interruptHandler: () => {
      ticks += 1;
      if (ticks > limits.fuel) {
        interruptedBy = 'fuel';
        return true;
      }
      // Checked on every tick, not every nth: QuickJS only calls this handler
      // once per ~10k bytecode operations, so a clock read here is already
      // rare, and sampling it less often is how a script that burns wall clock
      // in few operations — allocating hard enough to thrash the collector —
      // slips well past its deadline.
      if (Date.now() > deadline) {
        interruptedBy = 'timeout';
        return true;
      }
      return false;
    },
  });

  try {
    const context = runtime.newContext();
    try {
      const bootstrapped = Scope.withScope((scope) => {
        scope.manage(context.newString(inputJson)).consume((handle) => {
          context.setProp(context.global, inputGlobal, handle);
        });
        return context.evalCode(bootstrapSource, 'nova:bootstrap', { type: 'global' });
      });

      if (bootstrapped.error) {
        const failure = describeError(context, bootstrapped.error);
        return { ...failure, message: `Could not hand the world to ${androidId}: ${failure.message}` };
      }
      bootstrapped.value.dispose();

      // `type: 'global'` rather than the library's module/global heuristic: only
      // global code yields the last expression's value, which is what lets a
      // script end in `({ type: 'android.wait' })` with no `return`, exactly as
      // `node:vm` and `eval` did.
      const evaluated = context.evalCode(content, `${androidId}.js`, { type: 'global', backtraceBarrier: true });

      if (evaluated.error) {
        if (interruptedBy === 'fuel') {
          evaluated.error.dispose();
          return {
            ok: false,
            message: `Script for ${androidId} exceeded its ${limits.fuel}-tick CPU budget for the turn.`,
            stack: undefined,
          };
        }
        if (interruptedBy === 'timeout') {
          evaluated.error.dispose();
          return {
            ok: false,
            message: `Script for ${androidId} exceeded its ${limits.timeoutMs}ms turn budget.`,
            stack: undefined,
          };
        }
        return describeError(context, evaluated.error);
      }

      try {
        return { ok: true, actionJson: evaluated.value.consume((value) => stringifyAction(context, value)) };
      } catch (error) {
        return {
          ok: false,
          message: `The action from ${androidId} could not be returned: ${
            error instanceof Error ? error.message : String(error)
          }. Actions must be plain JSON-compatible objects.`,
          stack: undefined,
        };
      }
    } finally {
      context.dispose();
    }
  } finally {
    runtime.dispose();
  }
};

export type { SandboxInput, SandboxOutcome };
export { runInSandbox };
