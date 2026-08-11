import { createContext, runInContext } from 'node:vm';

import { ScriptExecuteOptions, ScriptRunner, toAndroidEvent } from '../src/nova-game.js';

/**
 * Test double for the `ScriptRunner` the host normally supplies.
 *
 * Deliberately `node:vm` rather than an import of the real QuickJS runner from
 * `@morten-olsen/nova-script-runner`: that package depends on this one, and
 * these tests only need a sandbox with a real timeout to cover the
 * runaway-script path. Parity between this and the shipped sandbox is pinned in
 * that package's `vm-parity` tests, not here.
 */
const createTestScriptRunner = (timeoutMs = 100): ScriptRunner => ({
  execute: async ({ androidId, content, world, rules }: ScriptExecuteOptions) => {
    const context = createContext({ androidId, world, rules, turn: world.round ?? 0, finalTurn: world.finalRound });
    const result = runInContext(content, context, { timeout: timeoutMs });
    return toAndroidEvent({ androidId, result });
  },
});

export { createTestScriptRunner };
