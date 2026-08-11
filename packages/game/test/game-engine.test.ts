import { describe, expect, it } from 'vitest';

import {
  createBaseRuleset,
  defaultRules,
  Loop,
  projectRecordingForPlayer,
  projectWorldForAndroid,
  projectWorldForPlayer,
  Ruleset,
  type Event,
  type Mechanic,
  type World,
} from '../src/nova-game.js';

import { createTestScriptRunner } from './vm-script-runner.js';

const emptyWorld = (): World => ({
  scripts: [],
  tiles: [],
  androids: [],
  buildings: [],
});

const createWorld = (overrides: Partial<World> = {}): World => ({
  ...emptyWorld(),
  ...overrides,
});

const createMutationFriendlyMechanic = (): Mechanic => ({
  name: 'mutation-friendly-test-mechanic',
  setup: ({ world }): World => {
    world.tiles.push({
      position: { x: 0, y: 0 },
      composition: { acid: 0, metal: 10 },
    });
    return world;
  },
  apply: ({ world, event }): World => {
    if (event.type === 'user.upload-android-script') {
      world.scripts.push({
        id: `${event.ownerId}-script-${world.scripts.length + 1}`,
        ownerId: event.ownerId,
        name: event.name,
        content: event.content,
      });
    }

    return world;
  },
});

const createAndroidTurnMechanic = (): Mechanic => ({
  name: 'android-turn-test-mechanic',
  apply: ({ world, event }): World => {
    if (event.type === 'android.move') {
      const android = world.androids.find((android) => android.id === event.androidId);
      if (!android) {
        throw new Error(`Unknown android: ${event.androidId}`);
      }

      if (event.direction === 'north' && android.position.y === 0) {
        throw new Error('Cannot move north from the northern edge');
      }

      if (event.direction === 'east') {
        android.position.x += 1;
      }

      if (event.direction === 'west') {
        android.position.x -= 1;
      }

      if (event.direction === 'north') {
        android.position.y -= 1;
      }

      if (event.direction === 'south') {
        android.position.y += 1;
      }
    }

    if (event.type === 'game.android-failed-turn') {
      const android = world.androids.find((android) => android.id === event.androidId);
      if (android) {
        android.active = false;
      }
    }

    return world;
  },
});

describe('game engine', () => {
  it('projects a fogged world for android scripts', async () => {
    const world = createWorld({
      scripts: [
        { id: 'own-script', ownerId: 'owner', name: 'own', content: '' },
        { id: 'other-script', ownerId: 'other', name: 'other', content: '' },
      ],
      tiles: [
        { position: { x: 0, y: 0 }, composition: { acid: 0 } },
        { position: { x: 1, y: 0 }, composition: { acid: 0 }, revealedBy: ['owner'] },
        { position: { x: 2, y: 0 }, composition: { acid: 0 }, revealedBy: ['other'] },
      ],
      androids: [
        {
          id: 'owner-android',
          ownerId: 'owner',
          scriptId: 'own-script',
          position: { x: 0, y: 0 },
          battery: 100,
          health: 100,
          active: true,
        },
        {
          id: 'other-android',
          ownerId: 'other',
          scriptId: 'other-script',
          position: { x: 2, y: 0 },
          battery: 100,
          health: 100,
          active: true,
        },
      ],
      buildings: [
        {
          id: 'hidden-building',
          ownerId: 'other',
          type: 'depot',
          position: { x: 2, y: 0 },
          remainingConstruction: { ticks: 0, resources: {} },
        },
      ],
      players: [
        { id: 'owner', name: 'Owner' },
        { id: 'other', name: 'Other' },
      ],
      messages: [
        {
          id: 'hidden-message',
          senderAndroidId: 'other-android',
          ownerId: 'other',
          position: { x: 2, y: 0 },
          content: 'hidden',
        },
      ],
    });

    const fogged = projectWorldForAndroid(world, 'owner-android');

    expect(fogged.tiles.map((tile) => tile.position.x)).toEqual([0, 1]);
    expect(fogged.androids.map((android) => android.id)).toEqual(['owner-android']);
    expect(fogged.buildings).toEqual([]);
    expect(fogged.messages).toEqual([]);
    expect(fogged.scripts.map((script) => script.id)).toEqual(['own-script']);
    expect(fogged.players).toEqual([{ id: 'owner', name: 'Owner' }]);

    // The loop hands the runner an already-fogged world, so a script that
    // counts tiles sees only the two revealed above, not the whole board.
    const event = await createTestScriptRunner().execute({
      androidId: 'owner-android',
      content: "({ type: world.tiles.length === 2 ? 'android.wait' : 'android.move', direction: 'east' })",
      world: fogged,
      rules: defaultRules,
    });
    expect(event.type).toBe('android.wait');
  });

  it('redacts another player’s scripts and Android state without hiding the world', () => {
    const world = createWorld({
      scripts: [
        { id: 'own-script', ownerId: 'owner', name: 'own', content: 'own source' },
        { id: 'other-script', ownerId: 'other', name: 'other', content: 'private source' },
      ],
      androids: [
        {
          id: 'other-android',
          ownerId: 'other',
          scriptId: 'other-script',
          position: { x: 2, y: 0 },
          battery: 100,
          health: 100,
          active: true,
          memory: 'private memory',
          recording: 'private recording',
        },
      ],
    });

    const playerWorld = projectWorldForPlayer(world, 'owner');
    expect(playerWorld.scripts).toHaveLength(2);
    expect(playerWorld.androids).toHaveLength(1);
    expect(playerWorld.scripts[1]?.content).toBe('[Redacted]');
    expect(playerWorld.androids[0]).toEqual(expect.objectContaining({ memory: '[Redacted]', recording: '[Redacted]' }));

    const recording = projectRecordingForPlayer(
      {
        version: 1,
        initialWorld: world,
        events: [
          {
            type: 'android.wait',
            androidId: 'other-android',
            memory: 'updated private memory',
            recording: 'updated private recording',
          },
        ],
      },
      'owner',
    );
    expect(recording.initialWorld.scripts[1]?.content).toBe('[Redacted]');
    expect(recording.events[0]).toEqual(expect.objectContaining({ memory: '[Redacted]', recording: '[Redacted]' }));
  });

  it('composes the base mechanics into a playable upload, launch, move, and fail loop', async () => {
    const loop = new Loop({
      scriptRunner: createTestScriptRunner(),
      ruleset: createBaseRuleset({
        world: {
          width: 2,
          height: 1,
          composition: { acid: 1, metal: 2 },
        },
      }),
    });

    expect(loop.world.tiles).toEqual([
      { position: { x: 0, y: 0 }, composition: { acid: 1, metal: 2 } },
      { position: { x: 1, y: 0 }, composition: { acid: 1, metal: 2 } },
    ]);

    loop.applyEvents([
      {
        type: 'user.upload-android-script',
        ownerId: 'player-1',
        name: 'go east',
        content: "({ type: 'android.move', direction: 'east' })",
      },
      {
        type: 'user.launch-android',
        ownerId: 'player-1',
        scriptId: 'script-1',
      },
    ]);

    await loop.run();

    expect(loop.world.androids).toEqual([
      expect.objectContaining({
        id: 'android-1',
        ownerId: 'player-1',
        scriptId: 'script-1',
        position: { x: 1, y: 0 },
        battery: 99,
        active: true,
      }),
    ]);

    await loop.run();

    // The second move would leave the map. That costs the round and some health,
    // but the android stays in play.
    expect(loop.world.androids).toEqual([
      expect.objectContaining({
        id: 'android-1',
        position: { x: 1, y: 0 },
        battery: 99,
        health: expect.closeTo(88.8, 5),
        active: true,
      }),
    ]);
    expect(loop.events.map((event) => event.type)).toEqual([
      'user.upload-android-script',
      'user.launch-android',
      'game.round-start',
      'android.move',
      'game.round-end',
      'game.round-start',
      'game.android-failed-turn',
      'game.round-end',
    ]);
  });

  it('persists an android memory and recording alongside its action', async () => {
    const loop = new Loop({
      scriptRunner: createTestScriptRunner(),
      ruleset: createBaseRuleset({ world: { width: 1, height: 1 } }),
    });

    loop.applyEvents([
      {
        type: 'user.upload-android-script',
        ownerId: 'player-1',
        name: 'remember',
        content: `
          const android = world.androids.find((candidate) => candidate.id === androidId);
          ({
            type: 'android.wait',
            memory: 'seek-depot',
            recording: \`${"${android?.recording ?? ''}"}waited\\n\`,
          })
        `,
      },
      {
        type: 'user.launch-android',
        ownerId: 'player-1',
        scriptId: 'script-1',
      },
    ]);

    await loop.run();

    expect(loop.world.androids[0]).toEqual(expect.objectContaining({ memory: 'seek-depot', recording: 'waited\n' }));
    expect(loop.events).toContainEqual(
      expect.objectContaining({ type: 'android.wait', memory: 'seek-depot', recording: 'waited\n' }),
    );
  });

  /**
   * `recording` is the player's only account of a match played with limited
   * disclosure, so whether a refused action still records matters to how a
   * competitive Android is written.
   */
  it('discards the memory and recording written by a rejected action', async () => {
    const loop = new Loop({
      scriptRunner: createTestScriptRunner(),
      ruleset: createBaseRuleset({ world: { width: 3, height: 3 } }),
    });

    loop.applyEvents([
      {
        type: 'user.upload-android-script',
        ownerId: 'player-1',
        // The android starts at 0,0, so moving north leaves the map.
        content: `({ type: 'android.move', direction: 'north', memory: 'noted', recording: 'noted' })`,
        name: 'walks-off-the-map',
      },
      {
        type: 'user.launch-android',
        ownerId: 'player-1',
        scriptId: 'script-1',
      },
    ]);

    await loop.run();

    expect(loop.events.map((event) => event.type)).toContain('game.android-failed-turn');
    expect(loop.world.androids[0]).toEqual(expect.objectContaining({ memory: '', recording: '' }));
  });

  /**
   * A refused action is a script bug. Costing the round and some health keeps the
   * mistake expensive without ending a run over one bad edge case — but a script
   * that never stops making it still runs its android into the ground.
   */
  it('wears an android down over repeated failed turns until it is destroyed', async () => {
    const loop = new Loop({
      scriptRunner: createTestScriptRunner(),
      ruleset: createBaseRuleset({ world: { width: 3, height: 3, composition: { acid: 0 } } }),
    });

    loop.applyEvents([
      {
        type: 'user.upload-android-script',
        ownerId: 'player-1',
        // The android starts at 0,0, so moving north leaves the map every round.
        content: `({ type: 'android.move', direction: 'north' })`,
        name: 'walks-off-the-map',
      },
      { type: 'user.launch-android', ownerId: 'player-1', scriptId: 'script-1' },
    ]);

    await loop.run();

    expect(loop.world.androids[0]).toEqual(
      expect.objectContaining({
        active: true,
        health: expect.closeTo(
          defaultRules.android.startingHealth -
            defaultRules.android.failedTurnHealthPenalty -
            defaultRules.android.decayPerRound,
          5,
        ),
      }),
    );

    for (let round = 0; round < 9; round += 1) {
      await loop.run();
    }

    expect(loop.world.androids).toEqual([expect.objectContaining({ id: 'android-1', active: false, health: 0 })]);
    // Only the rounds it survived cost it a turn.
    expect(loop.events.filter((event) => event.type === 'game.android-failed-turn')).toHaveLength(10);
  });

  /** The wreck is the only place a player can read what their android logged. */
  it('keeps a destroyed android in the world as a deactivated wreck', async () => {
    const loop = new Loop({
      scriptRunner: createTestScriptRunner(),
      ruleset: createBaseRuleset(),
      initWorld: createWorld({
        tiles: [
          { position: { x: 0, y: 0 }, composition: { acid: 0 } },
          { position: { x: 1, y: 0 }, composition: { acid: 4 } },
        ],
        scripts: [
          {
            id: 'move-script',
            ownerId: 'player-1',
            name: 'move',
            content: "({ type: 'android.move', direction: 'east', recording: 'last transmission' })",
          },
        ],
        androids: [
          {
            id: 'android-1',
            ownerId: 'player-1',
            scriptId: 'move-script',
            position: { x: 0, y: 0 },
            battery: 1,
            health: 100,
            active: true,
          },
        ],
      }),
    });

    await loop.run();

    expect(loop.world.androids).toEqual([
      expect.objectContaining({
        id: 'android-1',
        active: false,
        battery: 0,
        health: expect.closeTo(97.9, 5),
        recording: 'last transmission',
      }),
    ]);

    const health = loop.world.androids[0]?.health;
    await loop.run();

    // A wreck takes no turn and stops decaying, so its final state is readable.
    expect(loop.world.androids[0]).toEqual(expect.objectContaining({ health, active: false }));
    expect(loop.events.filter((event) => event.type === 'game.android-failed-turn')).toEqual([]);
  });

  it('uses base mechanics to charge androids and construct buildings', async () => {
    const loop = new Loop({
      scriptRunner: createTestScriptRunner(),
      ruleset: createBaseRuleset({ world: { width: 2, height: 1 } }),
      initWorld: createWorld({
        tiles: [
          { position: { x: 0, y: 0 }, composition: { acid: 0, metal: 10 } },
          { position: { x: 1, y: 0 }, composition: { acid: 0, metal: 10 } },
        ],
        scripts: [
          {
            id: 'charge-script',
            ownerId: 'player-1',
            name: 'charge',
            content: "({ type: 'android.charge' })",
          },
          {
            id: 'build-script',
            ownerId: 'player-1',
            name: 'build',
            content: "({ type: 'android.start-construction', buildingType: 'charger', resources: { metal: 4 } })",
          },
        ],
        androids: [
          {
            id: 'charging-android',
            ownerId: 'player-1',
            scriptId: 'charge-script',
            position: { x: 0, y: 0 },
            battery: 50,
            health: 100,
            active: true,
          },
          {
            id: 'building-android',
            ownerId: 'player-1',
            scriptId: 'build-script',
            position: { x: 1, y: 0 },
            battery: 100,
            health: 100,
            active: true,
          },
        ],
        buildings: [
          {
            id: 'charger-1',
            ownerId: 'player-1',
            type: 'charger',
            position: { x: 0, y: 0 },
            remainingConstruction: { ticks: 0, resources: { metal: 0 } },
          },
        ],
      }),
    });

    await loop.run();

    expect(loop.world.androids).toEqual([
      expect.objectContaining({ id: 'charging-android', battery: 75, active: true }),
      expect.objectContaining({ id: 'building-android', active: true }),
    ]);
    expect(loop.world.buildings).toEqual([
      expect.objectContaining({ id: 'charger-1' }),
      expect.objectContaining({
        id: 'building-2',
        ownerId: 'player-1',
        type: 'charger',
        position: { x: 1, y: 0 },
        remainingConstruction: { ticks: 2, resources: { metal: 6 } },
      }),
    ]);
  });
  it('damages androids standing in acid at round end', async () => {
    const loop = new Loop({
      scriptRunner: createTestScriptRunner(),
      ruleset: createBaseRuleset(),
      initWorld: createWorld({
        tiles: [{ position: { x: 0, y: 0 }, composition: { acid: 4 } }],
        scripts: [
          {
            id: 'wait-script',
            ownerId: 'player-1',
            name: 'wait',
            content: "({ type: 'android.wait' })",
          },
        ],
        androids: [
          {
            id: 'android-1',
            ownerId: 'player-1',
            scriptId: 'wait-script',
            position: { x: 0, y: 0 },
            battery: 100,
            health: 100,
            active: true,
          },
        ],
      }),
    });

    await loop.run();

    expect(loop.world.androids[0]).toEqual(expect.objectContaining({ health: 97.9 }));
  });

  it('allows androids to clean adjacent acid when their owner has an acid processing plant', async () => {
    const loop = new Loop({
      scriptRunner: createTestScriptRunner(),
      ruleset: createBaseRuleset(),
      initWorld: createWorld({
        tiles: [
          { position: { x: 0, y: 0 }, composition: { acid: 0 } },
          { position: { x: 1, y: 0 }, composition: { acid: 2 } },
        ],
        scripts: [
          {
            id: 'clean-script',
            ownerId: 'player-1',
            name: 'clean',
            content: "({ type: 'android.clean-acid', direction: 'east' })",
          },
        ],
        androids: [
          {
            id: 'android-1',
            ownerId: 'player-1',
            scriptId: 'clean-script',
            position: { x: 0, y: 0 },
            battery: 100,
            health: 100,
            active: true,
          },
        ],
        buildings: [
          {
            id: 'acid-plant-1',
            ownerId: 'player-1',
            type: 'acid-processing-plant',
            position: { x: 0, y: 0 },
            remainingConstruction: { ticks: 0, resources: { metal: 0 } },
          },
        ],
      }),
    });

    await loop.run();

    expect(loop.world.tiles[1]).toEqual(expect.objectContaining({ composition: { acid: 1 } }));
    expect(loop.world.buildings[0]).toEqual(
      expect.objectContaining({ storage: expect.objectContaining({ acidCanister: 1 }) }),
    );
  });

  /**
   * An android launching a sibling spends the same charger capacity a player
   * launch does, so a fleet cannot grow past the cap by launching itself.
   */
  const createLaunchWorld = (
    chargerPositions: { x: number; y: number }[],
    androidPosition = { x: 0, y: 0 },
    androidId = 'android-1',
  ): World =>
    createWorld({
      tiles: [
        { position: { x: 0, y: 0 }, composition: { acid: 0 } },
        { position: { x: 1, y: 0 }, composition: { acid: 0 } },
        { position: { x: 2, y: 0 }, composition: { acid: 0 } },
      ],
      scripts: [
        {
          id: 'launch-script',
          ownerId: 'player-1',
          name: 'launch',
          content: "({ type: 'android.launch', scriptId: 'wait-script' })",
        },
        { id: 'wait-script', ownerId: 'player-1', name: 'wait', content: "({ type: 'android.wait' })" },
      ],
      androids: [
        {
          id: androidId,
          ownerId: 'player-1',
          scriptId: 'launch-script',
          position: androidPosition,
          battery: 100,
          health: 100,
          active: true,
        },
      ],
      buildings: chargerPositions.map((position, index) => ({
        id: `charger-${index + 1}`,
        ownerId: 'player-1',
        type: 'charger' as const,
        position,
        remainingConstruction: { ticks: 0, resources: { metal: 0 } },
      })),
    });

  it('lets an android on a charger launch a sibling into spare capacity', async () => {
    const loop = new Loop({
      scriptRunner: createTestScriptRunner(),
      ruleset: createBaseRuleset(),
      initWorld: createLaunchWorld([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ]),
    });

    await loop.run();

    expect(loop.world.androids).toEqual([
      expect.objectContaining({ id: 'android-1', active: true }),
      expect.objectContaining({
        id: 'android-2',
        ownerId: 'player-1',
        scriptId: 'wait-script',
        position: { x: 0, y: 0 },
        health: 99.9,
        active: true,
      }),
    ]);
    // The launched android takes its first turn in the following round.
    expect(loop.events.map((event) => event.type)).toEqual(['game.round-start', 'android.launch', 'game.round-end']);
  });

  it('refuses an android launch that would exceed its owner charger capacity', async () => {
    const loop = new Loop({
      scriptRunner: createTestScriptRunner(),
      ruleset: createBaseRuleset(),
      initWorld: createLaunchWorld([{ x: 0, y: 0 }]),
    });

    await loop.run();

    expect(loop.events.map((event) => event.type)).toContain('game.android-failed-turn');
    expect(loop.world.androids).toEqual([
      expect.objectContaining({ id: 'android-1', active: true, health: expect.closeTo(89.9, 5) }),
    ]);
  });

  it('refuses an android launch away from an owned charger', async () => {
    const loop = new Loop({
      scriptRunner: createTestScriptRunner(),
      ruleset: createBaseRuleset(),
      initWorld: createLaunchWorld(
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        { x: 2, y: 0 },
      ),
    });

    await loop.run();

    expect(loop.events.map((event) => event.type)).toContain('game.android-failed-turn');
    expect(loop.world.androids).toHaveLength(1);
  });

  /** A world can arrive with id gaps, so the count alone would reissue a live id. */
  it('does not reuse the id of an android that is missing from the world', async () => {
    const loop = new Loop({
      scriptRunner: createTestScriptRunner(),
      ruleset: createBaseRuleset(),
      // As a hand-written or migrated world looks with `android-1` absent.
      initWorld: createLaunchWorld(
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        { x: 0, y: 0 },
        'android-2',
      ),
    });

    await loop.run();

    expect(loop.world.androids.map((android) => android.id)).toEqual(['android-2', 'android-3']);
  });

  const createDismantleWorld = (targetAndroidId: string, targetOwnerId = 'player-1'): World =>
    createWorld({
      tiles: [
        { position: { x: 0, y: 0 }, composition: { acid: 0 } },
        { position: { x: 1, y: 0 }, composition: { acid: 0 } },
      ],
      scripts: [
        {
          id: 'dismantle-script',
          ownerId: 'player-1',
          name: 'dismantle',
          content: `({ type: 'android.dismantle', targetAndroidId: '${targetAndroidId}' })`,
        },
        { id: 'wait-script', ownerId: targetOwnerId, name: 'wait', content: "({ type: 'android.wait' })" },
      ],
      androids: [
        {
          id: 'android-1',
          ownerId: 'player-1',
          scriptId: 'dismantle-script',
          position: { x: 0, y: 0 },
          battery: 100,
          health: 100,
          active: true,
        },
        {
          id: 'android-2',
          ownerId: targetOwnerId,
          scriptId: 'wait-script',
          position: { x: 1, y: 0 },
          battery: 100,
          health: 100,
          active: true,
        },
      ],
      buildings: [
        {
          id: 'charger-1',
          ownerId: 'player-1',
          type: 'charger',
          position: { x: 0, y: 0 },
          remainingConstruction: { ticks: 0, resources: { metal: 0 } },
        },
        {
          id: 'charger-2',
          ownerId: 'player-1',
          type: 'charger',
          position: { x: 1, y: 0 },
          remainingConstruction: { ticks: 0, resources: { metal: 0 } },
        },
      ],
    });

  it('lets an android on a charger dismantle a sibling of the same owner', async () => {
    const loop = new Loop({
      scriptRunner: createTestScriptRunner(),
      ruleset: createBaseRuleset(),
      initWorld: createDismantleWorld('android-2'),
    });

    await loop.run();

    // Deactivation is what frees the capacity; the wreck stays in the world.
    expect(loop.world.androids).toEqual([
      expect.objectContaining({ id: 'android-1', active: true }),
      expect.objectContaining({ id: 'android-2', active: false }),
    ]);
    expect(loop.events.map((event) => event.type)).toEqual(['game.round-start', 'android.dismantle', 'game.round-end']);
  });

  it('refuses an android dismantling another player android', async () => {
    const loop = new Loop({
      scriptRunner: createTestScriptRunner(),
      ruleset: createBaseRuleset(),
      initWorld: createDismantleWorld('android-2', 'player-2'),
    });

    await loop.run();

    expect(loop.events.map((event) => event.type)).toContain('game.android-failed-turn');
    expect(loop.world.androids).toContainEqual(expect.objectContaining({ id: 'android-2', active: true }));
  });

  /** Self-destruction is the untargeted form, so naming yourself is a mistake worth reporting. */
  it('refuses an android naming itself as a dismantle target', async () => {
    const loop = new Loop({
      scriptRunner: createTestScriptRunner(),
      ruleset: createBaseRuleset(),
      initWorld: createDismantleWorld('android-1'),
    });

    await loop.run();

    expect(loop.events.map((event) => event.type)).not.toContain('android.dismantle');
    expect(loop.events).toContainEqual(
      expect.objectContaining({
        type: 'game.android-failed-turn',
        androidId: 'android-1',
        error: { message: expect.stringContaining('cannot target itself') },
      }),
    );
  });

  it('reveals a radius-5 disc around a completed radar and nothing around an unfinished one', async () => {
    const loop = new Loop({
      scriptRunner: createTestScriptRunner(),
      ruleset: createBaseRuleset({ world: { width: 13, height: 13, composition: { acid: 0 } } }),
      initWorld: createWorld({
        buildings: [
          {
            id: 'radar-1',
            ownerId: 'player-1',
            type: 'radar',
            position: { x: 6, y: 6 },
            remainingConstruction: { ticks: 0, resources: {} },
          },
          {
            id: 'radar-2',
            ownerId: 'player-2',
            type: 'radar',
            position: { x: 0, y: 0 },
            remainingConstruction: { ticks: 3, resources: { metal: 4 } },
          },
        ],
      }),
    });

    await loop.run();

    const revealed = (x: number, y: number): boolean =>
      loop.world.tiles
        .find((tile) => tile.position.x === x && tile.position.y === y)
        ?.revealedBy?.includes('player-1') ?? false;

    expect(revealed(6, 6)).toBe(true);
    expect(revealed(11, 6)).toBe(true);
    expect(revealed(12, 6)).toBe(false);
    // The radar's footprint is a disc, not the walked-steps diamond the Androids
    // and scanners use: (9,9) is 6 orthogonal steps out but well inside radius 5.
    expect(revealed(9, 9)).toBe(true);
    expect(revealed(10, 9)).toBe(true);
    expect(revealed(10, 10)).toBe(false);

    // The unfinished radar sees nothing, including the tile it stands on.
    expect(loop.world.tiles.filter((tile) => tile.revealedBy?.includes('player-2'))).toEqual([]);
  });

  it('applies events through the ruleset while protecting loop state from caller mutations', () => {
    const initWorld = emptyWorld();
    const ruleset = new Ruleset({
      mechanics: [createMutationFriendlyMechanic()],
    });
    const loop = new Loop({ ruleset, initWorld, scriptRunner: createTestScriptRunner() });

    initWorld.tiles.push({
      position: { x: 99, y: 99 },
      composition: { acid: 99, metal: 99 },
    });

    const event: Event = {
      type: 'user.upload-android-script',
      ownerId: 'player-1',
      name: 'miner',
      content: "({ type: 'android.wait' })",
    };

    loop.applyEvents([event]);
    event.name = 'mutated-after-apply';

    const worldSnapshot = loop.world;
    const [scriptSnapshot] = worldSnapshot.scripts;
    expect(scriptSnapshot).toBeDefined();

    if (scriptSnapshot) {
      scriptSnapshot.name = 'mutated-snapshot';
    }

    expect(loop.world).toEqual({
      tiles: [
        {
          position: { x: 0, y: 0 },
          composition: { acid: 0, metal: 10 },
        },
      ],
      scripts: [
        {
          id: 'player-1-script-1',
          ownerId: 'player-1',
          name: 'miner',
          content: "({ type: 'android.wait' })",
        },
      ],
      androids: [],
      buildings: [],
    });
    expect(loop.events).toEqual([
      {
        type: 'user.upload-android-script',
        ownerId: 'player-1',
        name: 'miner',
        content: "({ type: 'android.wait' })",
      },
    ]);
  });

  it('runs a round, skips an android turn that produces an invalid move, and continues the round', async () => {
    const ruleset = new Ruleset({
      mechanics: [createAndroidTurnMechanic()],
    });
    const loop = new Loop({
      scriptRunner: createTestScriptRunner(),
      ruleset,
      initWorld: createWorld({
        scripts: [
          {
            id: 'bad-script',
            ownerId: 'player-1',
            name: 'bad move',
            content: "({ type: 'android.move', direction: 'north' })",
          },
          {
            id: 'good-script',
            ownerId: 'player-1',
            name: 'good move',
            content: "({ type: 'android.move', direction: 'east' })",
          },
        ],
        androids: [
          {
            id: 'bad-android',
            ownerId: 'player-1',
            scriptId: 'bad-script',
            position: { x: 0, y: 0 },
            battery: 100,
            health: 100,
            active: true,
          },
          {
            id: 'good-android',
            ownerId: 'player-1',
            scriptId: 'good-script',
            position: { x: 0, y: 0 },
            battery: 100,
            health: 100,
            active: true,
          },
        ],
      }),
    });

    await loop.run();

    expect(loop.world.androids).toEqual([
      expect.objectContaining({
        id: 'bad-android',
        position: { x: 0, y: 0 },
        active: false,
      }),
      expect.objectContaining({
        id: 'good-android',
        position: { x: 1, y: 0 },
        active: true,
      }),
    ]);
    expect(loop.events.map((event) => event.type)).toEqual([
      'game.round-start',
      'game.android-failed-turn',
      'android.move',
      'game.round-end',
    ]);
  });

  it('converts script timeouts into failed turns instead of hanging the round', async () => {
    const ruleset = new Ruleset({
      mechanics: [createAndroidTurnMechanic()],
    });
    const loop = new Loop({
      scriptRunner: createTestScriptRunner(),
      ruleset,
      initWorld: createWorld({
        scripts: [
          {
            id: 'script-1',
            ownerId: 'player-1',
            name: 'infinite loop',
            content: 'while (true) {}',
          },
        ],
        androids: [
          {
            id: 'android-1',
            ownerId: 'player-1',
            scriptId: 'script-1',
            position: { x: 0, y: 0 },
            battery: 100,
            health: 100,
            active: true,
          },
        ],
      }),
    });

    await loop.run();

    expect(loop.events.map((event) => event.type)).toEqual([
      'game.round-start',
      'game.android-failed-turn',
      'game.round-end',
    ]);
    expect(loop.world.androids[0]).toEqual(
      expect.objectContaining({
        id: 'android-1',
        active: false,
      }),
    );
  });
});
