import type { SandboxInput, SandboxOutcome } from '../runner/quickjs-sandbox.js';

/**
 * The messages exchanged with the script Worker.
 *
 * Everything crossing this boundary is plain data — the world travels as the
 * JSON string the sandbox wants anyway, so the structured clone algorithm never
 * has to walk the world tree.
 */
type ScriptWorkerRequest = SandboxInput & {
  type: 'run';
  id: number;
};

type ScriptWorkerResponse =
  /** Posted once, when the WebAssembly module has finished loading. */
  { type: 'ready' } | { type: 'result'; id: number; outcome: SandboxOutcome };

export type { ScriptWorkerRequest, ScriptWorkerResponse };
