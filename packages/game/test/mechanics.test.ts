import { describe, expect, it } from 'vitest';

import {
  calculateColonyScores,
  createBaseRuleset,
  defaultRules,
  type Building,
  type Event,
  type World,
} from '../src/nova-game.js';

const complete = { ticks: 0, resources: {} };
const emptyStorage = { metal: 0, electronics: 0, polymer: 0, ore: 0, water: 0, acidCanister: 0 };

const building = (overrides: Partial<Building> & Pick<Building, 'id' | 'type' | 'position'>): Building => ({
  ownerId: 'player-1',
  health: 100,
  initial: false,
  remainingConstruction: complete,
  ...overrides,
});

const staged = (rules: Parameters<typeof createBaseRuleset>[0] = {}) => {
  const ruleset = createBaseRuleset({
    world: { width: 4, height: 4, composition: { ore: 6, water: 3, acid: 2, radiation: 0 } },
    ...rules,
  });
  const world = ruleset.buildWorld({
    tiles: [],
    scripts: [],
    androids: [],
    buildings: [],
    players: [{ id: 'player-1', name: 'one' }],
    messages: [],
    round: 0,
  });
  const apply = (current: World, events: Event[]) => ruleset.applyEvents(current, events);
  return { ruleset, world, apply };
};

const withAndroid = (world: World, ownerId: string, id: string, position: { x: number; y: number }): World => {
  const next = structuredClone(world);
  next.androids.push({
    id,
    ownerId,
    scriptId: 'script-1',
    position,
    battery: 100,
    health: 100,
    active: true,
    cargo: { metal: 5 },
    memory: '',
    recording: '',
  });
  next.players?.push(...(ownerId === 'player-1' ? [] : [{ id: ownerId, name: ownerId }]));
  return next;
};

describe('a depot is where material is safe', () => {
  it('refuses hostile salvage, and still allows its owner to take it down', () => {
    const { world, apply } = staged();
    let current = structuredClone(world);
    current.buildings.push(
      building({ id: 'depot-1', type: 'depot', position: { x: 2, y: 2 }, storage: { metal: 40 } }),
    );
    current = withAndroid(current, 'player-2', 'raider', { x: 2, y: 2 });
    current = withAndroid(current, 'player-1', 'owner', { x: 2, y: 2 });

    expect(() => apply(current, [{ type: 'android.salvage', androidId: 'raider' }])).toThrow(
      /cannot be salvaged by another player/,
    );

    // The owner can, and the stockpile comes out onto the ground.
    let own = current;
    for (let hit = 0; hit < 4; hit += 1) {
      own = apply(own, [{ type: 'android.salvage', androidId: 'owner' }]);
    }
    expect(own.buildings.some((candidate) => candidate.type === 'depot')).toBe(false);
    expect(own.tiles.find((tile) => tile.position.x === 2 && tile.position.y === 2)?.scattered).toEqual(
      expect.objectContaining({ metal: 43 }),
    );
  });

  it('leaves other buildings raidable', () => {
    const { world, apply } = staged();
    let current = structuredClone(world);
    current.buildings.push(building({ id: 'extractor-1', type: 'extractor', position: { x: 2, y: 2 } }));
    current = withAndroid(current, 'player-2', 'raider', { x: 2, y: 2 });

    const after = apply(current, [{ type: 'android.salvage', androidId: 'raider' }]);
    expect(after.buildings[1]?.health).toBe(100 - defaultRules.salvage.hostileDamage);
  });
});

describe('repair', () => {
  it('puts health back for material, and refuses when there is nothing to fix', () => {
    const { world, apply } = staged();
    let current = structuredClone(world);
    current.buildings.push(building({ id: 'charger-2', type: 'charger', position: { x: 2, y: 2 }, health: 40 }));
    current = withAndroid(current, 'player-1', 'fixer', { x: 2, y: 2 });

    const repaired = apply(current, [{ type: 'android.repair', androidId: 'fixer' }]);
    expect(repaired.buildings[1]?.health).toBe(40 + defaultRules.salvage.repairAmount);
    expect(repaired.androids[0]?.cargo).toEqual(expect.objectContaining({ metal: 4 }));

    const undamaged = structuredClone(current);
    const target = undamaged.buildings[1];
    if (target) {
      target.health = 100;
    }
    expect(() => apply(undamaged, [{ type: 'android.repair', androidId: 'fixer' }])).toThrow(/not damaged/);
  });

  it('will not repair another player’s building', () => {
    const { world, apply } = staged();
    let current = structuredClone(world);
    current.buildings.push(
      building({ id: 'theirs', ownerId: 'player-2', type: 'charger', position: { x: 2, y: 2 }, health: 20 }),
    );
    current = withAndroid(current, 'player-1', 'fixer', { x: 2, y: 2 });

    expect(() => apply(current, [{ type: 'android.repair', androidId: 'fixer' }])).toThrow(/its own buildings/);
  });
});

describe('refining', () => {
  it('runs every recipe once a round, in order, so one building can feed itself', () => {
    const { world, apply } = staged();
    const current = structuredClone(world);
    // Enough ore for the metal line, and the water the electronics line needs.
    current.buildings.push(
      building({
        id: 'processor-1',
        type: 'processor',
        position: { x: 1, y: 1 },
        storage: { ...emptyStorage, ore: 2, metal: 1, water: 1 },
      }),
    );

    const after = apply(current, [{ type: 'game.round-end' }]);
    const storage = after.buildings.find((candidate) => candidate.id === 'processor-1')?.storage;
    // 2 ore became metal, and one metal plus water became one electronics: the
    // metal the first line made pays for the second, which is why they balance.
    expect(storage).toEqual(expect.objectContaining({ ore: 0, metal: 1, water: 0, electronics: 1 }));
  });

  it('turns cleaned-up acid into polymer at the plant', () => {
    const { world, apply } = staged();
    const current = structuredClone(world);
    current.buildings.push(
      building({
        id: 'plant-1',
        type: 'acid-processing-plant',
        position: { x: 1, y: 1 },
        storage: { ...emptyStorage, acidCanister: 1, water: 1 },
      }),
    );

    const after = apply(current, [{ type: 'game.round-end' }]);
    expect(after.buildings.find((candidate) => candidate.id === 'plant-1')?.storage).toEqual(
      expect.objectContaining({ acidCanister: 0, water: 0, polymer: 1 }),
    );
  });

  it('still accepts a single recipe, so an older rules file means what it did', () => {
    const ruleset = createBaseRuleset({
      buildings: { processor: { conversion: { input: { ore: 4 }, output: { metal: 3 } } } },
    });
    expect(ruleset.rules.buildings.processor.conversion).toEqual([{ input: { ore: 4 }, output: { metal: 3 } }]);
  });
});

describe('diminishing returns', () => {
  it('pays less for each further building of a type, and nothing changes at a rate of one', () => {
    const world: World = {
      scripts: [],
      tiles: [],
      androids: [],
      buildings: [1, 2, 3, 4].map((index) =>
        building({ id: `depot-${index}`, type: 'depot', position: { x: index, y: 0 } }),
      ),
      players: [{ id: 'player-1', name: 'one' }],
    };

    const tuned = calculateColonyScores(world, defaultRules)[0];
    // 40, then 40 x 0.7 each time: 40 + 28 + 20 + 14.
    expect(tuned?.total).toBe(102);
    expect(tuned?.contributors[0]).toEqual(expect.objectContaining({ quantity: 4, points: 102 }));

    const flat = createBaseRuleset({
      scoring: { buildings: { depot: { points: 40, label: 'Secured storage', diminishing: 1 } } },
    });
    expect(calculateColonyScores(world, flat.rules)[0]?.total).toBe(160);
  });
});
