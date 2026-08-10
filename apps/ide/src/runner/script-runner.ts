import { createWorkerScriptRunner, type WorkerScriptRunner } from '@morten-olsen/nova-script-runner/worker';

let runner: WorkerScriptRunner | undefined;

/**
 * The one script sandbox this app has.
 *
 * Shared rather than built per run because the runner owns a Worker that holds
 * a loaded QuickJS module: the expensive part of running a script is getting
 * that module in place, and a runner per sandbox run would pay for it on every
 * click of Run. Turn-to-turn isolation does not depend on the worker's
 * lifetime — the sandbox builds and destroys a QuickJS runtime per script — so
 * there is nothing to gain by throwing it away.
 *
 * Call this as early as the app can afford to: constructing the runner spawns
 * the worker, which starts the module load off the main thread.
 */
const getScriptRunner = (): WorkerScriptRunner => {
  runner ??= createWorkerScriptRunner();
  return runner;
};

export { getScriptRunner };
