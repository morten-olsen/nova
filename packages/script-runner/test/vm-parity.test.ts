import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';

import { defaultRules, rulesForWorld, toAndroidEvent, type World } from '@morten-olsen/nova-game';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { createQuickJsScriptRunner } from '../src/runner/quickjs-script-runner.js';
import { wrapAndroidModule } from '../src/module/android-module.js';

/**
 * QuickJS replaced two sandboxes: `node:vm` in the CLI and `eval`-in-a-Worker
 * in the browser. Both handed a script the value of its final expression
 * statement, which is what lets a bot end in `({ type: 'android.wait' })` with
 * no `return`, and every published bot depends on it.
 *
 * These tests pin that equivalence against the sandbox that is easiest to check
 * it with. If it ever stops holding, bots break everywhere at once — a failure
 * that would otherwise surface as "my bot just waits every turn".
 */
const world = {
  scripts: [],
  tiles: [{ position: { x: 0, y: 0 }, composition: { metal: 4 } }],
  androids: [
    {
      id: 'android-1',
      ownerId: 'player-1',
      scriptId: 'script-1',
      position: { x: 0, y: 0 },
      battery: 100,
      health: 100,
      active: true,
      cargo: {},
    },
  ],
  buildings: [],
  round: 1,
};

/** Measured from the stub world above, exactly as the loop measures it. */
const rules = rulesForWorld(defaultRules, world as World);

const runViaVm = (content: string): unknown =>
  runInContext(content, createContext({ androidId: 'android-1', world, rules, turn: 1, finalTurn: undefined }), {
    timeout: 1000,
  });

const runViaQuickJs = (content: string) =>
  createQuickJsScriptRunner().execute({ androidId: 'android-1', content, world: world as World, rules });

/** What `node:vm` produced, put through the same validator the runners use. */
const expectedEvent = (content: string) => toAndroidEvent({ androidId: 'android-1', result: runViaVm(content) });

const scriptForms = {
  'parenthesised object': "({ type: 'android.wait' })",
  'trailing semicolon': "({ type: 'android.move', direction: 'east' });",
  'immediately invoked function': "(() => ({ type: 'android.charge' }))();",
  'const then expression': "const d = 'north';\n({ type: 'android.move', direction: d });",
  'conditional expression': "world.tiles.length > 0 ? { type: 'android.collect' } : { type: 'android.wait' };",
  'comment after action': "({ type: 'android.wait' }); // done",
  'turn-aware expression': "turn > 0 ? { type: 'android.collect' } : { type: 'android.wait' };",
};

describe('QuickJS and node:vm agree on the script contract', () => {
  for (const [name, content] of Object.entries(scriptForms)) {
    it(`returns the same action for a ${name}`, async () => {
      await expect(runViaQuickJs(content)).resolves.toEqual(expectedEvent(content));
    });
  }

  it('agrees on the shipped starter bot', async () => {
    // The starter bot is a TypeScript module, and both sandboxes only ever see
    // what it compiles to: a CommonJS module, wrapped in the call that makes its
    // exported turn function the script's final expression.
    const source = await readFile(new URL('../../../docs/examples/starter-builder.ts', import.meta.url), 'utf8');
    const content = wrapAndroidModule(
      ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS },
      }).outputText,
    );
    await expect(runViaQuickJs(content)).resolves.toEqual(expectedEvent(content));
  });

  it('mangles an unparenthesised action identically, and explains it', async () => {
    // The classic mistake, and subtler than it looks: without parentheses this
    // is a block containing the label `type:` applied to a string, so the
    // completion value is the bare string rather than an object. Both engines
    // agree on that, which is what makes the engine's shared advice correct in
    // both places.
    const content = "{ type: 'android.wait' }";
    expect(runViaVm(content)).toBe('android.wait');
    await expect(runViaQuickJs(content)).rejects.toThrowError(/must produce an action object/);
  });
});
