import { toAndroidEvent, type ScriptExecuteOptions, type ScriptRunner } from '@morten-olsen/nova-game';

import ScriptWorker from './script-worker.ts?worker';
import type { ScriptWorkerRequest, ScriptWorkerResponse } from './script-worker.ts';

type WorkerScriptRunnerOptions = {
  timeoutMs?: number;
};

/**
 * Runs android scripts in a dedicated Worker.
 *
 * A Worker rather than a bare `eval` on the main thread for one reason that
 * matters: `while (true) {}` in a script must not take the tab with it. Nothing
 * can interrupt a running script from the inside, so the timeout has to come
 * from outside it — the host starts a timer and calls `terminate()`, which is a
 * hard kill rather than a cooperative one. That makes the browser's timeout
 * strictly more reliable than the CLI's, where `node:vm` cannot interrupt a
 * pending microtask.
 *
 * A fresh worker per turn costs a few milliseconds and buys isolation between
 * turns: no accumulated globals, no leaked state, and the script contract's
 * "cannot retain state between turns" rule holds by construction rather than by
 * convention. Note this is an isolation boundary, not a security one.
 */
const createWorkerScriptRunner = (options: WorkerScriptRunnerOptions = {}): ScriptRunner => {
  const timeoutMs = options.timeoutMs ?? 1000;

  return {
    // `world` arrives already fogged by the loop, so it can be exposed as-is.
    execute: ({ androidId, content, world }: ScriptExecuteOptions) =>
      new Promise((resolve, reject) => {
        const worker = new ScriptWorker();
        let settled = false;

        /** Tears the worker down; returns false if someone already won the race. */
        const claim = (): boolean => {
          if (settled) {
            return false;
          }
          settled = true;
          clearTimeout(timer);
          worker.terminate();
          return true;
        };

        const timer = setTimeout(() => {
          if (claim()) {
            reject(new Error(`Script for ${androidId} exceeded its ${timeoutMs}ms turn budget.`));
          }
        }, timeoutMs);

        worker.addEventListener('message', (event: MessageEvent<ScriptWorkerResponse>) => {
          const response = event.data;
          if (!claim()) {
            return;
          }
          if (!response.ok) {
            reject(Object.assign(new Error(response.message), { stack: response.stack }));
            return;
          }
          // Validation lives here rather than in the settle path because a
          // malformed action must reject the promise, not throw into this
          // listener where nothing would ever settle.
          try {
            resolve(toAndroidEvent({ androidId, result: response.result }));
          } catch (error) {
            reject(error);
          }
        });

        // Fires for parse errors and anything else that kills the worker before
        // it can report for itself.
        worker.addEventListener('error', (event: ErrorEvent) => {
          if (claim()) {
            reject(new Error(event.message || `Script for ${androidId} failed to load.`));
          }
        });

        worker.postMessage({ androidId, content, world } satisfies ScriptWorkerRequest);
      }),
  };
};

export type { WorkerScriptRunnerOptions };
export { createWorkerScriptRunner };
