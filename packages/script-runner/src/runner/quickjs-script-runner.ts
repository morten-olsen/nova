import type { ScriptExecuteOptions, ScriptRunner } from '@morten-olsen/nova-game';

import { loadQuickJs, warmUpQuickJs } from '../quickjs/quickjs-module.js';

import { runInSandbox } from './quickjs-sandbox.js';
import { toAndroidEventFromOutcome, toSandboxInputJson } from './sandbox-result.js';
import { resolveLimits, type ScriptLimits } from './script-limits.js';

type QuickJsScriptRunnerOptions = {
  limits?: ScriptLimits;
};

/**
 * Runs android scripts in QuickJS, in this thread.
 *
 * The same sandbox in Node and in the browser, which is the point: a bot that
 * runs in the IDE runs identically under `nova run`, down to which language
 * features exist and where a runaway loop is cut off.
 *
 * Blocks the calling thread for as long as a script runs. That is fine for the
 * CLI; a browser host that cares about frame rate should use the Worker runner
 * from `@morten-olsen/nova-script-runner/worker` instead, which wraps this same
 * sandbox.
 */
const createQuickJsScriptRunner = (options: QuickJsScriptRunnerOptions = {}): ScriptRunner => {
  const limits = resolveLimits(options.limits);
  // Kicked off at construction rather than on the first turn: hosts build their
  // runner well before the first round, so the WebAssembly load overlaps with
  // whatever else startup is doing.
  void warmUpQuickJs();

  return {
    execute: async ({ androidId, content, world }: ScriptExecuteOptions) => {
      // Asked for per turn rather than held from construction: this is a cached
      // promise, and re-reading it is what lets a runner pick up a replacement
      // module after one has been aborted.
      const module = await loadQuickJs();
      const outcome = runInSandbox(module, {
        androidId,
        content,
        inputJson: toSandboxInputJson({ androidId, world }),
        limits,
      });
      return toAndroidEventFromOutcome({ androidId, outcome });
    },
  };
};

export type { QuickJsScriptRunnerOptions };
export { createQuickJsScriptRunner };
