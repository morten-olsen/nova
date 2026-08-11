/**
 * Machinery for measuring balance: seeded worlds, bots that run as scripts, and
 * one game played to the end.
 *
 * Deliberately not a `ScriptRunner` with a sandbox in it. A balance question is
 * about the rules, not about the interpreter, and calling a bot as a function
 * makes a hundred games cheap enough to answer a question with. A bot still sees
 * exactly what a script sees, because the loop projects the world before handing
 * it over.
 */

import {
  calculateColonyScores,
  createBaseRuleset,
  Loop,
  toAndroidEvent,
  type AndroidAction,
  type Event,
  type PlayerScore,
  type Rules,
  type RulesInput,
  type ScriptRunner,
  type World,
} from '../dist/nova-game.js';

/** What a bot is handed: the script globals, by the names a script knows. */
type BotGlobals = {
  androidId: string;
  world: World;
  rules: Rules;
  turn: number;
  finalTurn: number | undefined;
};

type Bot = (globals: BotGlobals) => AndroidAction;

/**
 * Deterministic map generation.
 *
 * `game.create-map` rolls its tiles with `Math.random`, so a seeded generator is
 * swapped in around world construction: two runs of the same seed are the same
 * planet, which is the only way a rules change can be told apart from luck.
 */
const mulberry32 = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const withSeed = <T>(seed: number, fn: () => T): T => {
  const original = Math.random;
  Math.random = mulberry32(seed);
  try {
    return fn();
  } finally {
    Math.random = original;
  }
};

const createBotRunner = (bots: Record<string, Bot>): ScriptRunner => ({
  execute: async ({ androidId, content, world, rules }) => {
    const bot = bots[content];
    if (!bot) {
      throw new Error(`Unknown bot: ${content}`);
    }

    return toAndroidEvent({
      androidId,
      result: bot({ androidId, world, rules, turn: world.round ?? 0, finalTurn: world.finalRound }),
    });
  },
});

type MatchOptions = {
  seed: number;
  rounds: number;
  rules?: RulesInput;
  /** One entry per player, in seating order, naming the bot they play. */
  players: { id: string; bot: string }[];
  bots: Record<string, Bot>;
  /** A prepared world, for measuring a colony that already exists. */
  initWorld?: World;
};

type MatchResult = {
  world: World;
  events: Event[];
  scores: PlayerScore[];
  failures: string[];
  rules: Rules;
};

/** Plays one game to the end and hands back everything worth measuring. */
const playMatch = async (options: MatchOptions): Promise<MatchResult> => {
  const { seed, rounds, rules = {}, players, bots, initWorld } = options;
  const ruleset = withSeed(seed, () => createBaseRuleset({ ...rules, match: { finalRound: rounds } }));
  const loop = withSeed(
    seed,
    () =>
      new Loop({
        ruleset,
        scriptRunner: createBotRunner(bots),
        // Seated up front, so `game.place-charger` spreads them to opposite
        // corners rather than the scan order a lazily created player would get.
        initWorld: initWorld ?? {
          tiles: [],
          scripts: [],
          androids: [],
          buildings: [],
          players: players.map((player) => ({ id: player.id, name: player.id })),
          messages: [],
          round: 0,
        },
      }),
  );

  players.forEach((player, index) => {
    loop.applyEvents([
      { type: 'user.upload-android-script', ownerId: player.id, name: player.bot, content: player.bot },
      { type: 'user.launch-android', ownerId: player.id, scriptId: `script-${index + 1}` },
    ]);
  });

  for (let round = 0; round < rounds; round += 1) {
    await loop.run();
  }

  const events = loop.events;
  return {
    world: loop.world,
    events,
    scores: calculateColonyScores(loop.world, ruleset.rules),
    failures: events.flatMap((event) => (event.type === 'game.android-failed-turn' ? [event.error.message] : [])),
    rules: ruleset.rules,
  };
};

/** A freshly generated world, for measuring what a map holds before anyone plays. */
const generateWorld = (seed: number, rules: RulesInput = {}): World =>
  withSeed(seed, () =>
    createBaseRuleset(rules).buildWorld({
      tiles: [],
      scripts: [],
      androids: [],
      buildings: [],
      players: [],
      messages: [],
      round: 0,
    }),
  );

const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;

const stdev = (values: number[]): number => {
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
};

const fmt = (value: number, digits = 1): string => value.toFixed(digits);

/** Loose material lying on the ground, which is the pool the early game lives on. */
const looseMaterial = (world: World): number =>
  world.tiles.reduce(
    (total, tile) =>
      total + (tile.scattered?.metal ?? 0) + (tile.scattered?.electronics ?? 0) + (tile.scattered?.polymer ?? 0),
    0,
  );

export type { Bot, BotGlobals, MatchOptions, MatchResult };
export { fmt, generateWorld, looseMaterial, mean, playMatch, stdev, withSeed };
