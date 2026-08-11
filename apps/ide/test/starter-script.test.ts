import { calculateColonyScores, createBaseRuleset, Loop } from '@morten-olsen/nova-game';
import { createQuickJsScriptRunner, wrapAndroidModule } from '@morten-olsen/nova-script-runner';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { starterScript } from '../src/lab/starter-script.ts';

/**
 * Compiled and wrapped the way the lab does it: the same compiler, the same
 * module format, and the same wrapper that turns an exported turn function into
 * the single expression the sandbox evaluates.
 */
const emitted = ts.transpileModule(starterScript, {
  compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS },
}).outputText;

const content = wrapAndroidModule(emitted);

/**
 * The starter script is the first thing anyone sees, and the thing they copy.
 * A bot that walks off the map on round 3 teaches the wrong lesson, so this
 * plays it for real and asserts it survives and scores.
 *
 * Played through the same QuickJS sandbox the app ships, rather than a local
 * `eval` stand-in: the limits and the language surface are part of what the
 * starter script has to survive.
 */
const play = async (rounds: number, size = 10) => {
  const loop = new Loop({
    ruleset: createBaseRuleset({ world: { width: size, height: size } }),
    scriptRunner: createQuickJsScriptRunner(),
  });
  loop.applyEvents([
    { type: 'user.upload-android-script', ownerId: 'player-1', name: 'starter', content },
    { type: 'user.launch-android', ownerId: 'player-1', scriptId: 'script-1' },
  ]);
  for (let round = 0; round < rounds; round += 1) {
    await loop.run();
  }
  const failures = loop.events.filter((event) => event.type === 'game.android-failed-turn');
  return { failures, loop, world: loop.world };
};

describe('starter script', () => {
  it('never fails a turn over a long game', async () => {
    const { failures } = await play(60);
    // A failed turn deactivates the android permanently, so this is survival.
    expect(failures.map((failure) => failure.error.message)).toEqual([]);
  });

  it('keeps an android in the field, charged, for the whole game', async () => {
    const { world } = await play(60);
    // Not necessarily the *first* android: they decay, and a colony that has been
    // running for sixty rounds is expected to have replaced one. What matters is
    // that the player still has a working android, and that nothing it did ran
    // its battery to nothing.
    const own = world.androids.filter((android) => android.ownerId === 'player-1');
    expect(own.some((android) => android.active)).toBe(true);
    for (const android of own) {
      expect(android.battery).toBeGreaterThan(0);
    }
  });

  it('scores by banking material into completed buildings', async () => {
    const { world } = await play(60);
    const score = calculateColonyScores(world).find((entry) => entry.playerId === 'player-1');
    // The initial charger alone is 25, so anything at or below that means the
    // bot built nothing of its own.
    expect(score?.total ?? 0).toBeGreaterThan(25);
  });

  it('builds a depot, which is the cheapest points on the board', async () => {
    const { world } = await play(60);
    const depots = world.buildings.filter((building) => building.ownerId === 'player-1' && building.type === 'depot');
    expect(depots.length).toBeGreaterThanOrEqual(1);
  });

  it('survives a cramped map without walking off the edge', async () => {
    const { failures, world } = await play(40, 3);
    expect(failures.map((failure) => failure.error.message)).toEqual([]);
    expect(world.androids[0]?.active).toBe(true);
  });
});
