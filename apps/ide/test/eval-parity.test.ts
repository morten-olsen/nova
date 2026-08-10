import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';

import { createBaseRuleset, Loop, toAndroidEvent, type ScriptRunner } from '@morten-olsen/nova-game';
import { describe, expect, it } from 'vitest';

/**
 * The browser runner swaps `node:vm` for `eval`. That is only safe because both
 * yield the completion value of the script's final expression statement, which
 * is what lets a bot end in `({ type: 'android.wait' })` with no `return`.
 *
 * These tests pin that equivalence. If it ever stops holding, every published
 * script breaks in the browser while continuing to work in the CLI — a failure
 * that would otherwise show up as "my bot does nothing in the IDE".
 */
const indirectEval = eval;

const runViaVm = (content: string, globals: Record<string, unknown>): unknown =>
  runInContext(content, createContext({ ...globals }), { timeout: 1000 });

const runViaEval = (content: string, globals: Record<string, unknown>): unknown => {
  Object.assign(globalThis, globals);
  return indirectEval(content);
};

const scriptForms = {
  'parenthesised object': "({ type: 'android.wait' })",
  'trailing semicolon': "({ type: 'android.move', direction: 'east' });",
  'immediately invoked function': "(() => ({ type: 'android.charge' }))();",
  'const then expression': "const d = 'north';\n({ type: 'android.move', direction: d });",
  'conditional expression': "world.tiles.length > 0 ? { type: 'android.collect' } : { type: 'android.wait' };",
  'comment after action': "({ type: 'android.wait' }); // done",
};

describe('eval and node:vm agree on the script contract', () => {
  const globals = { androidId: 'android-1', world: { tiles: [{}], androids: [], buildings: [], scripts: [] } };

  for (const [name, content] of Object.entries(scriptForms)) {
    it(`returns the same completion value for a ${name}`, () => {
      expect(runViaEval(content, globals)).toEqual(runViaVm(content, globals));
    });
  }

  it('agrees on the shipped starter bot', async () => {
    const content = await readFile(new URL('../../../docs/examples/starter-builder.js', import.meta.url), 'utf8');
    const world = {
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
      scripts: [],
    };
    const scoped = { androidId: 'android-1', world };
    expect(runViaEval(content, scoped)).toEqual(runViaVm(content, scoped));
  });

  it('mangles an unparenthesised action identically in both', () => {
    // The classic mistake, and a subtler one than it looks: without parentheses
    // this is a block containing the label `type:` applied to a string, so the
    // completion value is the bare string rather than an object. Both engines
    // agree on that, which is what matters here.
    const content = "{ type: 'android.wait' }";
    expect(runViaEval(content, globals)).toBe('android.wait');
    expect(runViaVm(content, globals)).toBe('android.wait');
  });

  it('explains the unparenthesised case instead of failing obscurely', () => {
    const result = runViaEval("{ type: 'android.wait' }", globals);
    expect(() => toAndroidEvent({ androidId: 'android-1', result })).toThrowError(/must end in an action object/);
  });
});

describe('an eval-based runner drives the engine', () => {
  /** The worker's core, minus the postMessage plumbing a browser would add. */
  const evalScriptRunner: ScriptRunner = {
    execute: async ({ androidId, content, world }) =>
      toAndroidEvent({ androidId, result: runViaEval(content, { androidId, world }) }),
  };

  it('produces a recording the replay viewer can read', async () => {
    const loop = new Loop({
      ruleset: createBaseRuleset({ world: { width: 6, height: 6 } }),
      scriptRunner: evalScriptRunner,
    });
    loop.applyEvents([
      {
        type: 'user.upload-android-script',
        ownerId: 'player-1',
        name: 'east',
        content: "({ type: 'android.move', direction: 'east' })",
      },
      { type: 'user.launch-android', ownerId: 'player-1', scriptId: 'script-1' },
    ]);

    await loop.run();
    await loop.run();

    expect(loop.events.filter((event) => event.type === 'game.round-end')).toHaveLength(2);
    expect(loop.events.some((event) => event.type === 'game.android-failed-turn')).toBe(false);
    expect(loop.world.androids[0]?.position.x).toBe(2);
    // Replaying the recording must reproduce the world the loop ended on.
    expect(createBaseRuleset().applyEvents(loop.initialWorld, loop.events)).toEqual(loop.world);
  });
});
