import type { AndroidEvent, ScriptExecuteOptions, ScriptRunner } from '@morten-olsen/nova-game';

import { toAndroidEventFromOutcome, toSandboxInputJson } from '../runner/sandbox-result.js';
import { resolveLimits, type ScriptLimits } from '../runner/script-limits.js';

import { createPendingTurns } from './pending-turns.js';
import type { ScriptWorkerRequest, ScriptWorkerResponse } from './worker-protocol.js';

type WorkerScriptRunnerOptions = {
  limits?: ScriptLimits;
  /**
   * How long past a script's own wall-clock budget the host waits before
   * declaring the worker wedged and replacing it.
   *
   * The sandbox interrupts its own scripts, so this only fires when the worker
   * stops answering for a reason no interrupt handler can reach.
   */
  graceMs?: number;
  /**
   * Overrides how the Worker is constructed.
   *
   * The default resolves the worker entry relative to this module, which is
   * what a bundler needs to emit it as its own chunk. Hosts that bundle
   * differently — or tests that want a stub — can supply their own.
   */
  createWorker?: () => Worker;
};

type WorkerScriptRunner = ScriptRunner & {
  /** Resolves once the worker's WebAssembly module is loaded and turns will not pay for it. */
  ready: () => Promise<void>;
  /** Terminates the worker and fails anything still in flight. */
  dispose: () => void;
};

const defaultCreateWorker = (): Worker =>
  new Worker(new URL('./script-runner.worker.ts', import.meta.url), { type: 'module' });

/**
 * Runs android scripts in QuickJS, inside one long-lived Worker.
 *
 * Two things move off the main thread: the module load, so it never competes
 * with first paint, and the scripts themselves, so a bot that spends its whole
 * CPU budget does not drop a single frame of the UI. Turns are messages to a
 * worker that is already warm rather than a worker spawned per turn.
 *
 * Unlike the `eval`-in-a-Worker runner this replaces, `terminate()` is no
 * longer the timeout mechanism — QuickJS interrupts its own scripts from the
 * inside. Termination is kept only as a watchdog for a worker that has stopped
 * answering altogether.
 */
const createWorkerScriptRunner = (options: WorkerScriptRunnerOptions = {}): WorkerScriptRunner => {
  const limits = resolveLimits(options.limits);
  const graceMs = options.graceMs ?? 500;
  const createWorker = options.createWorker ?? defaultCreateWorker;

  const pending = createPendingTurns();
  let worker: Worker | undefined;
  let nextId = 0;
  let signalReady: () => void;
  let readyPromise = new Promise<void>((resolve) => {
    signalReady = resolve;
  });

  const onMessage = (event: MessageEvent<ScriptWorkerResponse>): void => {
    const response = event.data;
    if (response.type === 'ready') {
      signalReady();
      return;
    }

    // Absent means its watchdog already fired, or it belonged to a worker that
    // has since been replaced.
    const turn = pending.take(response.id);

    // Validation lives on this side of the boundary so a malformed action
    // rejects the turn's promise rather than throwing into a message listener,
    // where nothing would ever settle.
    try {
      turn?.resolve(toAndroidEventFromOutcome({ androidId: turn.androidId, outcome: response.outcome }));
    } catch (error) {
      turn?.reject(error instanceof Error ? error : new Error(String(error)));
    }
  };

  /** Drops the current worker and fails every turn that was counting on it. */
  const discardWorker = (toError: (androidId: string) => Error): void => {
    worker?.terminate();
    worker = undefined;
    readyPromise = new Promise<void>((resolve) => {
      signalReady = resolve;
    });
    pending.drain(toError);
  };

  const getWorker = (): Worker => {
    if (!worker) {
      worker = createWorker();
      worker.addEventListener('message', onMessage as EventListener);
      worker.addEventListener('error', (event: Event) => {
        const message = event instanceof ErrorEvent && event.message ? event.message : 'The script worker failed.';
        discardWorker(() => new Error(message));
      });
    }
    return worker;
  };

  const startTurn = (androidId: string, run: (id: number) => void): Promise<AndroidEvent> =>
    new Promise<AndroidEvent>((resolve, reject) => {
      const id = nextId;
      nextId += 1;

      const timer = setTimeout(() => {
        pending.take(id);
        discardWorker(
          (queued) => new Error(`Script for ${queued} was cancelled: the script worker stopped responding.`),
        );
        reject(new Error(`Script for ${androidId} exceeded its ${limits.timeoutMs}ms turn budget.`));
      }, limits.timeoutMs + graceMs);

      pending.add(id, { androidId, resolve, reject, timer });
      run(id);
    });

  // Spawned eagerly: the whole reason for a persistent worker is that the load
  // happens now rather than during the first turn.
  getWorker();

  return {
    ready: () => readyPromise,

    dispose: () => {
      discardWorker((androidId) => new Error(`Script for ${androidId} was cancelled: the runner was disposed.`));
    },

    // `world` arrives already fogged by the loop, so it can be serialized as-is.
    execute: ({ androidId, content, world }: ScriptExecuteOptions) =>
      startTurn(androidId, (id) => {
        getWorker().postMessage({
          type: 'run',
          id,
          androidId,
          content,
          inputJson: toSandboxInputJson({ androidId, world }),
          limits,
        } satisfies ScriptWorkerRequest);
      }),
  };
};

export type { WorkerScriptRunner, WorkerScriptRunnerOptions };
export { createWorkerScriptRunner };
