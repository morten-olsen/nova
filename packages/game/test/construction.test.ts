import { describe, expect, it } from 'vitest';

import {
  androidEventSchema,
  calculateColonyScores,
  createBaseRuleset,
  defaultRules,
  type Building,
  type Event,
  type World,
} from '../src/nova-game.js';

/**
 * A small flat board with one player, one android, and nothing loose on the
 * ground: every unit of material in these tests is one the test put there.
 */
const flatWorld = (rules: Parameters<typeof createBaseRuleset>[0] = {}) => {
  const ruleset = createBaseRuleset({
    world: { width: 3, height: 3, composition: { ore: 4, water: 2, acid: 0, radiation: 0 } },
    ...rules,
  });
  const built = ruleset.buildWorld({
    tiles: [],
    scripts: [],
    androids: [],
    buildings: [],
    players: [],
    messages: [],
    round: 0,
  });
  const world = ruleset.applyEvents(built, [
    { type: 'user.upload-android-script', ownerId: 'player-1', name: 'bot', content: 'x' },
    { type: 'user.launch-android', ownerId: 'player-1', scriptId: 'script-1' },
  ]);
  const apply = (current: World, events: Event[]) => ruleset.applyEvents(current, events);
  return { ruleset, world, apply };
};

/** The android these tests act with, without an assertion the lint rules forbid. */
const actor = (world: World) => {
  const [android] = world.androids;
  if (!android) {
    throw new Error('The staged world has no android');
  }
  return android;
};

const scatteredAt = (world: World, x: number, y: number) =>
  world.tiles.find((tile) => tile.position.x === x && tile.position.y === y)?.scattered;

const totalOf = (materials: Record<string, number | undefined> | undefined): number =>
  Object.values(materials ?? {}).reduce((sum, amount) => sum + (amount ?? 0), 0);

const completedDepot = (overrides: Partial<Building> = {}): Building => ({
  id: 'depot-1',
  ownerId: 'player-1',
  type: 'depot',
  position: { x: 2, y: 2 },
  health: 100,
  initial: false,
  remainingConstruction: { ticks: 0, resources: {} },
  ...overrides,
});

describe('paying for construction', () => {
  it('refuses material the building does not need, however cheap that material is', () => {
    const { world, apply } = flatWorld();
    const staged = structuredClone(world);
    // A hold full of ore, and not one unit of the metal a depot is made of.
    actor(staged).cargo = { ore: 10 };
    actor(staged).position = { x: 1, y: 1 };

    expect(() =>
      apply(staged, [
        {
          type: 'android.start-construction',
          androidId: 'android-1',
          buildingType: 'depot',
          resources: { ore: 10 },
        },
      ]),
    ).toThrow(/does not need that much ore/);
  });

  it('refuses more of the right material than the building needs', () => {
    const { world, apply } = flatWorld();
    const staged = structuredClone(world);
    actor(staged).cargo = { metal: 10 };
    actor(staged).position = { x: 1, y: 1 };

    expect(() =>
      apply(staged, [
        {
          type: 'android.start-construction',
          androidId: 'android-1',
          buildingType: 'depot',
          resources: { metal: 8 },
        },
      ]),
    ).toThrow(/does not need that much metal/);
  });

  it('refuses a negative request, which would run the action backwards', () => {
    expect(() =>
      androidEventSchema.parse({
        type: 'android.deposit',
        androidId: 'android-1',
        resources: { metal: -1000 },
      }),
    ).toThrow();
  });
});

describe('what a building has to be finished to do', () => {
  it('will not charge, store, or hand back material from a site under construction', () => {
    const { world, apply } = flatWorld();
    const staged = structuredClone(world);
    actor(staged).cargo = { metal: 12 };
    actor(staged).position = { x: 1, y: 1 };
    const site = apply(staged, [
      {
        type: 'android.start-construction',
        androidId: 'android-1',
        buildingType: 'charger',
        resources: defaultRules.buildings.charger.cost,
      },
    ]);

    expect(site.buildings.some((building) => building.position.x === 1 && building.position.y === 1)).toBe(true);
    expect(() => apply(site, [{ type: 'android.charge', androidId: 'android-1' }])).toThrow(/completed charger/);

    const depotSite = apply(staged, [
      { type: 'android.start-construction', androidId: 'android-1', buildingType: 'depot', resources: { metal: 6 } },
    ]);
    expect(() => apply(depotSite, [{ type: 'android.deposit', androidId: 'android-1' }])).toThrow(/completed/);
    expect(() =>
      apply(depotSite, [{ type: 'android.withdraw', androidId: 'android-1', resources: { metal: 1 } }]),
    ).toThrow(/completed/);
  });

  it('does not score, extract, or convert for a site whose material is still owed', () => {
    // `ticks: 0` used to make a site count as finished the moment it was placed,
    // because completion was measured by ticks alone.
    const { ruleset, world, apply } = flatWorld({
      buildings: { depot: { ticks: 0 }, extractor: { ticks: 0 } },
    });
    const staged = structuredClone(world);
    actor(staged).position = { x: 1, y: 1 };
    const placed = apply(staged, [
      { type: 'android.start-construction', androidId: 'android-1', buildingType: 'extractor' },
      { type: 'game.round-end' },
    ]);

    const site = placed.buildings.find((building) => building.type === 'extractor');
    expect(site?.remainingConstruction.resources).toEqual(defaultRules.buildings.extractor.cost);
    expect(totalOf(site?.storage)).toBe(0);
    expect(calculateColonyScores(placed, ruleset.rules)[0]?.total).toBe(25);
  });
});

describe('salvage', () => {
  it('returns nothing for a site that was never paid for', () => {
    const { world, apply } = flatWorld();
    const staged = structuredClone(world);
    actor(staged).position = { x: 1, y: 1 };
    let current = apply(staged, [
      { type: 'android.start-construction', androidId: 'android-1', buildingType: 'colony-module' },
    ]);
    for (let hit = 0; hit < 4; hit += 1) {
      current = apply(current, [{ type: 'android.salvage', androidId: 'android-1' }]);
    }

    expect(current.buildings.some((building) => !building.initial)).toBe(false);
    expect(totalOf(scatteredAt(current, 1, 1))).toBe(0);
  });

  it('returns a share of what was actually invested, and spills the stockpile', () => {
    const { world, apply } = flatWorld();
    const staged = structuredClone(world);
    actor(staged).position = { x: 2, y: 2 };
    staged.buildings.push(completedDepot({ storage: { metal: 30, water: 5 } }));

    let current = staged;
    for (let hit = 0; hit < 4; hit += 1) {
      current = apply(current, [{ type: 'android.salvage', androidId: 'android-1' }]);
    }

    // 60% of the depot's 6 metal, plus everything that was stored inside it.
    expect(scatteredAt(current, 2, 2)).toEqual(expect.objectContaining({ metal: 33, water: 5 }));
  });
});

describe('starting positions', () => {
  it('spreads initial chargers to opposite corners however players are created', () => {
    const { world, apply } = flatWorld();
    const twoPlayers = apply(world, [
      { type: 'user.upload-android-script', ownerId: 'player-2', name: 'bot', content: 'x' },
    ]);

    const chargers = twoPlayers.buildings.filter((building) => building.initial);
    expect(chargers.map((charger) => `${charger.ownerId} ${charger.position.x},${charger.position.y}`)).toEqual([
      'player-1 0,0',
      'player-2 2,2',
    ]);
  });
});
