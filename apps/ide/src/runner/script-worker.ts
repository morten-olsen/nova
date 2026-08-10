/**
 * The sandbox half of {@link createWorkerScriptRunner}.
 *
 * One worker runs one script and is then discarded, which is what makes the
 * host's `terminate()` a reliable timeout: there is no state to leave behind
 * and no way for a runaway script to outlive its turn.
 */

type ScriptWorkerRequest = {
  androidId: string;
  content: string;
  world: unknown;
};

type ScriptWorkerResponse = { ok: true; result: unknown } | { ok: false; message: string; stack?: string };

/**
 * Indirect `eval` — the parenthesised form matters twice over.
 *
 * It returns the completion value of the script's final expression statement,
 * matching what `runInContext` gives the CLI, so a script ending in
 * `({ type: 'android.wait' })` works identically in both. `new Function` would
 * require an explicit `return` and silently break every published bot.
 *
 * It also forces evaluation in global scope, so a script cannot close over this
 * module's locals — including `request`, which holds the unfogged-looking world
 * object we are about to expose deliberately.
 */
const indirectEval = eval;

const run = ({ androidId, content, world }: ScriptWorkerRequest): unknown => {
  // Assigned to globalThis rather than passed in, because the script contract
  // is two bare globals rather than a function signature.
  Object.assign(globalThis, { androidId, world });
  return indirectEval(content);
};

self.addEventListener('message', (event: MessageEvent<ScriptWorkerRequest>) => {
  let response: ScriptWorkerResponse;
  try {
    response = { ok: true, result: run(event.data) };
  } catch (error) {
    response = {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };
  }

  try {
    self.postMessage(response);
  } catch {
    // The action came back holding something structured-clone cannot copy — a
    // function or a class instance. Reported as a script error rather than
    // letting postMessage throw into the worker's error handler, where the host
    // would see a timeout instead of the real cause.
    self.postMessage({
      ok: false,
      message: 'The action could not be returned. Actions must be plain JSON-compatible objects.',
    } satisfies ScriptWorkerResponse);
  }
});

export type { ScriptWorkerRequest, ScriptWorkerResponse };
