import { createContext, runInContext } from 'node:vm';

import { ScriptExecuteOptions, ScriptRunner, toAndroidEvent } from '@morten-olsen/nova-game';

type VmScriptRunnerOptions = {
  timeoutMs?: number;
};

/**
 * Runs android scripts in a Node VM context.
 *
 * `runInContext` returns the completion value of the script's final expression
 * statement, which is what lets a script end in `({ type: 'android.wait' })`
 * rather than an explicit return. Browser hosts get the same semantics from
 * `eval`; `new Function` would not, so it is not an interchangeable shortcut.
 *
 * Note that a VM context is an isolation boundary, not a security one — it
 * keeps a misbehaving script from touching the host's globals, but it is not
 * hardened against a hostile one.
 */
const createVmScriptRunner = (options: VmScriptRunnerOptions = {}): ScriptRunner => {
  const timeoutMs = options.timeoutMs ?? 1000;

  return {
    // `world` arrives already fogged by the loop, so it can be exposed as-is.
    execute: async ({ androidId, content, world }: ScriptExecuteOptions) => {
      const context = createContext({ androidId, world });
      const result = runInContext(content, context, { timeout: timeoutMs });
      return toAndroidEvent({ androidId, result });
    },
  };
};

export type { VmScriptRunnerOptions };
export { createVmScriptRunner };
