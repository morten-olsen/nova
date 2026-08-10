/**
 * The sandbox half of {@link createWorkerScriptRunner}.
 *
 * Long-lived, unlike the per-turn worker this replaced: the expensive thing
 * here is the WebAssembly module, and keeping the worker alive is what lets it
 * be loaded once and reused for every turn of every match. Isolation between
 * turns does not depend on the worker's lifetime any more — the sandbox builds
 * a fresh QuickJS runtime per script and destroys it afterwards, so nothing a
 * script does can outlive its own turn.
 */

import { loadQuickJs, warmUpQuickJs } from '../quickjs/quickjs-module.js';
import { runInSandbox } from '../runner/quickjs-sandbox.js';

import type { ScriptWorkerRequest, ScriptWorkerResponse } from './worker-protocol.js';

const post = (response: ScriptWorkerResponse): void => {
  self.postMessage(response);
};

// Started on spawn rather than on the first request: the host spawns the worker
// at boot precisely so this load happens while the user is still looking at the
// editor rather than waiting on a turn.
void warmUpQuickJs().then(() => post({ type: 'ready' }));

self.addEventListener('message', (event: MessageEvent<ScriptWorkerRequest>) => {
  const request = event.data;
  if (request.type !== 'run') {
    return;
  }

  // `loadQuickJs` per request rather than a module captured on spawn, so a turn
  // that aborts the module does not condemn this worker to answering every
  // later turn with the corpse.
  void loadQuickJs().then((module) => {
    post({ type: 'result', id: request.id, outcome: runInSandbox(module, request) });
  });
});
