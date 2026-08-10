import { createContext, runInContext } from 'node:vm';

import { ScriptExecuteOptions, ScriptRunner, toAndroidEvent } from '../src/nova-game.js';

/**
 * Test double for the `ScriptRunner` the host normally supplies.
 *
 * Deliberately a near-copy of the CLI's `createVmScriptRunner` rather than an
 * import of it: the engine must not depend on an app, and these tests need a
 * sandbox with a real timeout to cover the runaway-script path.
 */
const createTestScriptRunner = (timeoutMs = 100): ScriptRunner => ({
  execute: async ({ androidId, content, world }: ScriptExecuteOptions) => {
    const context = createContext({ androidId, world });
    const result = runInContext(content, context, { timeout: timeoutMs });
    return toAndroidEvent({ androidId, result });
  },
});

export { createTestScriptRunner };
