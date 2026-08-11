import { describe, expect, it } from 'vitest';

import {
  calculateColonyScores,
  createBaseRuleset,
  createTimeline,
  defaultRules,
  Loop,
  parseRecording,
  resolveRules,
  rulesForWorld,
  rulesSchema,
  type World,
} from '../src/nova-game.js';

import { createTestScriptRunner } from './vm-script-runner.js';

const emptyWorld = (): World => ({
  scripts: [],
  tiles: [],
  androids: [],
  buildings: [],
});

/** Uploads a script, launches one android on it, and plays `rounds` rounds. */
const play = async (rules: Parameters<typeof createBaseRuleset>[0], content: string, rounds = 1) => {
  const loop = new Loop({ scriptRunner: createTestScriptRunner(), ruleset: createBaseRuleset(rules) });
  loop.applyEvents([
    { type: 'user.upload-android-script', ownerId: 'player-1', name: 'test', content },
    { type: 'user.launch-android', ownerId: 'player-1', scriptId: 'script-1' },
  ]);
  for (let round = 0; round < rounds; round += 1) {
    await loop.run();
  }
  return loop;
};

describe('rules', () => {
  it('resolves an empty object into the whole shipped game', () => {
    const rules = resolveRules({});

    expect(rules).toEqual(defaultRules);
    expect(rules.world).toEqual(expect.objectContaining({ width: 16, height: 16, composition: null }));
    expect(rules.android.cargoCapacity).toBe(10);
    expect(rules.buildings.charger).toEqual(
      expect.objectContaining({ cost: { metal: 10 }, ticks: 2, charge: 25, androidCapacity: 1 }),
    );
    expect(rules.buildings.radar.sight).toEqual({ range: 5, shape: 'circular' });
    expect(rules.scoring.buildings['colony-module'].points).toBe(1_000);
    expect(rules.match.finalRound).toBeNull();
  });

  it('fills in everything left out of a partial override', () => {
    const rules = resolveRules({ android: { cargoCapacity: 4 }, buildings: { depot: { ticks: 9 } } });

    expect(rules.android.cargoCapacity).toBe(4);
    // Same group, untouched.
    expect(rules.android.batteryCapacity).toBe(defaultRules.android.batteryCapacity);
    // Same building, untouched.
    expect(rules.buildings.depot.ticks).toBe(9);
    expect(rules.buildings.depot.cost).toEqual(defaultRules.buildings.depot.cost);
    // Other buildings, untouched.
    expect(rules.buildings.charger).toEqual(defaultRules.buildings.charger);
  });

  it('rejects a value the game could not be played with', () => {
    expect(() => resolveRules({ world: { width: 0 } })).toThrow();
    expect(() => resolveRules({ android: { cargoCapacity: -1 } })).toThrow();
    // A sight rule is supplied whole, so half of one cannot silently inherit the
    // shape of a different sight source.
    expect(() => rulesSchema.parse({ buildings: { radar: { sight: { range: 6 } } } })).toThrow();
  });

  it('generates the board the world rules describe', () => {
    const ruleset = createBaseRuleset({ world: { width: 3, height: 2, composition: { ore: 1 } } });
    const world = ruleset.buildWorld(emptyWorld());

    expect(world.tiles).toHaveLength(6);
    expect(world.tiles.every((tile) => tile.composition.ore === 1)).toBe(true);
  });

  it('plays the numbers it was given rather than the defaults', async () => {
    const loop = await play(
      {
        world: { width: 4, height: 4, composition: { acid: 0 } },
        android: { moveBatteryCost: 7, decayPerRound: 0 },
      },
      "({ type: 'android.move', direction: 'east' })",
    );

    expect(loop.world.androids[0]).toEqual(
      expect.objectContaining({ position: { x: 1, y: 0 }, battery: 93, health: 100 }),
    );
  });

  it('scores under the rules the match was played with', () => {
    const ruleset = createBaseRuleset({
      world: { width: 2, height: 2 },
      scoring: { buildings: { charger: { points: 5, label: 'Power' } } },
    });
    const world = ruleset.buildWorld({ ...emptyWorld(), players: [{ id: 'player-1', name: 'One' }] });

    // One initial charger, worth 25 as the game ships and 5 under these rules.
    expect(calculateColonyScores(world)[0]?.total).toBe(25);
    expect(calculateColonyScores(world, ruleset.rules)[0]).toEqual(
      expect.objectContaining({ total: 5, contributors: [expect.objectContaining({ label: 'Power', points: 5 })] }),
    );
  });

  it('keeps a building worth no points out of the breakdown', () => {
    const ruleset = createBaseRuleset({
      world: { width: 2, height: 2 },
      scoring: { buildings: { charger: { points: 0, label: 'Power' } } },
    });
    const world = ruleset.buildWorld({ ...emptyWorld(), players: [{ id: 'player-1', name: 'One' }] });

    expect(calculateColonyScores(world, ruleset.rules)[0]).toEqual(
      expect.objectContaining({ total: 0, contributors: [] }),
    );
  });

  it('hands a script the rules as a global', async () => {
    const loop = await play(
      { world: { width: 2, height: 2, composition: { acid: 0 } }, android: { cargoCapacity: 3 } },
      "({ type: 'android.wait', memory: JSON.stringify([rules.android.cargoCapacity, rules.world.width]) })",
    );

    expect(loop.world.androids[0]?.memory).toBe('[3,2]');
  });

  it('measures the board a script is told about from the world, not from the generation rule', () => {
    // A hand-authored world keeps the tiles it was written with, so the rule that
    // would have generated a 16x16 board is not the board this script is on.
    const world: World = {
      ...emptyWorld(),
      tiles: [
        { position: { x: 0, y: 0 }, composition: {} },
        { position: { x: 1, y: 0 }, composition: {} },
        { position: { x: 2, y: 0 }, composition: {} },
      ],
    };

    expect(rulesForWorld(defaultRules, world).world).toEqual(expect.objectContaining({ width: 3, height: 1 }));
    // Nothing else is touched.
    expect(rulesForWorld(defaultRules, world).android).toEqual(defaultRules.android);
    // An empty world has no board to measure.
    expect(rulesForWorld(defaultRules, emptyWorld()).world).toEqual(defaultRules.world);
  });

  it('schedules the end of a match from the rules', () => {
    const world = createBaseRuleset({ match: { finalRound: 30 } }).buildWorld(emptyWorld());
    expect(world.finalRound).toBe(30);

    expect(createBaseRuleset().buildWorld(emptyWorld()).finalRound).toBeUndefined();
  });

  it('enforces the memory limit as a rule, refusing the turn that exceeds it', async () => {
    const loop = await play(
      { world: { width: 2, height: 2, composition: { acid: 0 } }, android: { memoryLimit: 4 } },
      "({ type: 'android.wait', memory: 'far too long' })",
    );

    expect(loop.events.map((event) => event.type)).toContain('game.android-failed-turn');
    expect(loop.world.androids[0]?.memory).toBe('');

    const within = await play(
      { world: { width: 2, height: 2, composition: { acid: 0 } }, android: { memoryLimit: 4 } },
      "({ type: 'android.wait', memory: 'ok' })",
    );
    expect(within.world.androids[0]?.memory).toBe('ok');
  });

  it('stores its rules in a recording so a replay is played under them', async () => {
    const loop = await play(
      { world: { width: 2, height: 2, composition: { acid: 0 } }, android: { cargoCapacity: 2 } },
      "({ type: 'android.wait' })",
    );
    const written = { version: 1, initialWorld: loop.initialWorld, rules: loop.rules, events: loop.events };

    const reopened = parseRecording(JSON.stringify(written));
    expect(reopened.rules.android.cargoCapacity).toBe(2);
    expect(createTimeline(reopened).at(-1)?.world).toEqual(loop.world);
  });

  it('opens a recording written before rules were data, under the numbers it was played with', () => {
    const world = createBaseRuleset({ world: { width: 2, height: 2 } }).buildWorld(emptyWorld());
    const legacy = JSON.stringify({ version: 1, initialWorld: world, events: [] });

    expect(parseRecording(legacy).rules).toEqual(defaultRules);
  });
});
