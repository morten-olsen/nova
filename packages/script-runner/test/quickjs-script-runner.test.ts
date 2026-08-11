import {
  createBaseRuleset,
  defaultRules,
  Loop,
  resolveRules,
  type RulesInput,
  type World,
} from '@morten-olsen/nova-game';
import { describe, expect, it } from 'vitest';

import { createQuickJsScriptRunner } from '../src/runner/quickjs-script-runner.js';

const world: World = {
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
  round: 3,
};

const run = (content: string, overrides: Partial<World> = {}, rules: RulesInput | undefined = undefined) =>
  createQuickJsScriptRunner().execute({
    androidId: 'android-1',
    content,
    world: { ...world, ...overrides },
    rules: rules === undefined ? defaultRules : resolveRules(rules),
  });

describe('the QuickJS runner and the script contract', () => {
  it('takes the final expression as the action', async () => {
    await expect(run("({ type: 'android.wait' })")).resolves.toEqual({
      type: 'android.wait',
      androidId: 'android-1',
    });
  });

  it('takes the final expression through a trailing semicolon and a comment', async () => {
    await expect(run("({ type: 'android.move', direction: 'east' }); // go")).resolves.toEqual({
      type: 'android.move',
      direction: 'east',
      androidId: 'android-1',
    });
  });

  it('exposes androidId and the fogged world', async () => {
    await expect(
      run('({ type: world.tiles.length === 1 && androidId === "android-1" ? "android.collect" : "android.wait" })'),
    ).resolves.toMatchObject({ type: 'android.collect' });
  });

  it('exposes the current turn', async () => {
    await expect(run("({ type: 'android.wait', memory: String(turn) })")).resolves.toMatchObject({ memory: '3' });
  });

  it('leaves finalTurn readable but undefined when the match has no scheduled end', async () => {
    await expect(run("({ type: 'android.wait', memory: String(finalTurn === undefined) })")).resolves.toMatchObject({
      memory: 'true',
    });
  });

  it('exposes finalTurn when the world carries one', async () => {
    await expect(
      run("({ type: 'android.wait', memory: String(finalTurn - turn) })", { finalRound: 10 }),
    ).resolves.toMatchObject({ memory: '7' });
  });

  it('exposes the rules the match is played under', async () => {
    await expect(run("({ type: 'android.wait', memory: String(rules.android.cargoCapacity) })")).resolves.toMatchObject(
      { memory: '10' },
    );
    // Not the shipped numbers: whatever this match was tuned to.
    await expect(
      run(
        "({ type: 'android.wait', memory: String(rules.android.cargoCapacity) })",
        {},
        { android: { cargoCapacity: 3 } },
      ),
    ).resolves.toMatchObject({ memory: '3' });
  });

  it('explains a script that does not end in an action object', async () => {
    await expect(run("{ type: 'android.wait' }")).rejects.toThrowError(/must produce an action object/);
  });

  it('reports the message a script threw', async () => {
    await expect(run("throw new Error('bad plan')")).rejects.toThrowError(/bad plan/);
  });
});

describe('per-turn resource limits', () => {
  it('interrupts a runaway loop with the CPU budget', async () => {
    await expect(run('while (true) {}')).rejects.toThrowError(/CPU budget/);
  });

  it('spends its CPU budget in a bounded amount of wall clock', async () => {
    const started = Date.now();
    await expect(run('while (true) {}')).rejects.toThrowError(/CPU budget/);
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it('stops a script that asks for more heap than its turn is allowed', async () => {
    const runner = createQuickJsScriptRunner({ limits: { memoryBytes: 4 * 1024 * 1024 } });
    await expect(
      runner.execute({ androidId: 'android-1', content: "const hog = 'x'.repeat(50000000); hog.length", world }),
    ).rejects.toThrowError(/out of memory/i);
  });

  it('cuts off a script that burns wall clock without burning through its CPU budget', async () => {
    // Allocation churn thrashes the collector, so this spends seconds in very
    // few bytecode operations — the case the tick budget alone cannot catch.
    const started = Date.now();
    const runner = createQuickJsScriptRunner({ limits: { timeoutMs: 300, memoryBytes: 64 * 1024 * 1024 } });
    await expect(
      runner.execute({
        androidId: 'android-1',
        content: 'const hog = []; while (true) { hog.push(new Array(10000).fill("x")); }',
        world,
      }),
    ).rejects.toThrowError(/turn budget/);
    expect(Date.now() - started).toBeLessThan(1_500);
  });

  it('reports runaway recursion as a script error rather than crashing the sandbox', async () => {
    await expect(run('const f = () => f(); f();')).rejects.toThrowError(/stack overflow|call stack/i);
  });

  it('clamps a stack limit large enough to take the WebAssembly module down with it', async () => {
    // The clamp is the only thing standing between a bot author's typo and an
    // aborted module, so it is asserted through the public option rather than
    // trusted to `resolveLimits`.
    const runner = createQuickJsScriptRunner({ limits: { stackBytes: 8 * 1024 * 1024 } });
    await expect(
      runner.execute({ androidId: 'android-1', content: 'const f = () => f(); f();', world }),
    ).rejects.toThrowError(/stack overflow|call stack/i);
    await expect(
      runner.execute({ androidId: 'android-1', content: "({ type: 'android.wait' })", world }),
    ).resolves.toMatchObject({ type: 'android.wait' });
  });

  it('hands the next turn a clean slate after a script exhausts its memory', async () => {
    const runner = createQuickJsScriptRunner({ limits: { memoryBytes: 4 * 1024 * 1024 } });
    const hog = { androidId: 'android-1', content: 'const a = []; while (true) { a.push(new Array(1000)); }', world };
    await expect(runner.execute(hog)).rejects.toThrowError(/./);
    await expect(
      runner.execute({ androidId: 'android-1', content: "({ type: 'android.wait' })", world }),
    ).resolves.toMatchObject({ type: 'android.wait' });
  });
});

describe('isolation between turns', () => {
  it('does not let a script leave state behind for the next one', async () => {
    const runner = createQuickJsScriptRunner();
    await runner.execute({
      androidId: 'android-1',
      content: "globalThis.sneaky = 1; ({ type: 'android.wait' })",
      world,
    });
    await expect(
      runner.execute({
        androidId: 'android-1',
        content: "({ type: 'android.wait', memory: String(typeof globalThis.sneaky) })",
        world,
      }),
    ).resolves.toMatchObject({ memory: 'undefined' });
  });

  it('does not expose the host to the script', async () => {
    await expect(
      run("({ type: 'android.wait', memory: String(typeof process) + typeof require })"),
    ).resolves.toMatchObject({ memory: 'undefinedundefined' });
  });
});

describe('driving the engine', () => {
  it('produces a recording that replays to the same world', async () => {
    const loop = new Loop({
      ruleset: createBaseRuleset({ world: { width: 6, height: 6 } }),
      scriptRunner: createQuickJsScriptRunner(),
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

    expect(loop.events.some((event) => event.type === 'game.android-failed-turn')).toBe(false);
    expect(loop.world.androids[0]?.position.x).toBe(2);
    expect(createBaseRuleset().applyEvents(loop.initialWorld, loop.events)).toEqual(loop.world);
  });
});
