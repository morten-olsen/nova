/**
 * The balance bench: what a map holds, what a turn earns, when each phase of the
 * game happens, and whether any one strategy is the answer.
 *
 * Run with `pnpm --filter @morten-olsen/nova-game bench`. Every number is
 * produced from the real mechanics on seeded maps, so a rules change can be told
 * apart from luck by running it again.
 *
 * The reasoning these numbers support lives in `docs/BALANCE.md`. When a default
 * moves, re-run this and update that.
 */

import { readFileSync } from 'node:fs';

import type { Building, RulesInput } from '../dist/nova-game.js';

import { archetypes } from './balance-bots.ts';
import { fmt, generateWorld, looseMaterial, mean, playMatch, stdev } from './balance-harness.ts';

const SEEDS = Number(process.env.SEEDS ?? 6);
/**
 * `RULES=path/to/rules.json` measures a candidate instead of the shipped game,
 * which is how a tuning pass gets a before and an after rather than an opinion.
 */
const OVERRIDES: RulesInput = process.env.RULES
  ? (JSON.parse(readFileSync(process.env.RULES, 'utf8')) as RulesInput)
  : {};
const FIELD = Object.keys(archetypes);
const INDUSTRY: Building['type'][] = ['extractor', 'processor', 'acid-processing-plant'];

const census = (rules: RulesInput = {}): void => {
  const rows = Array.from({ length: 40 }, (_, index) => {
    const world = generateWorld(index + 1, rules);
    const material = { metal: 0, electronics: 0, polymer: 0, ore: 0 };
    for (const tile of world.tiles) {
      material.metal += tile.scattered?.metal ?? 0;
      material.electronics += tile.scattered?.electronics ?? 0;
      material.polymer += tile.scattered?.polymer ?? 0;
      material.ore += tile.composition.ore ?? 0;
    }
    return material;
  });

  console.log('== what a map holds (40 seeds) ==');
  console.log(
    `  loose: metal ${fmt(mean(rows.map((r) => r.metal)), 0)}  electronics ${fmt(mean(rows.map((r) => r.electronics)), 0)}  polymer ${fmt(mean(rows.map((r) => r.polymer)), 0)}`,
  );
  console.log(`  in the ground: ore ${fmt(mean(rows.map((r) => r.ore)), 0)}`);
  const enough = rows.filter((r) => r.electronics >= 20 && r.polymer >= 20).length / rows.length;
  console.log(`  maps scattering a colony module's electronics and polymer outright: ${fmt(enough * 100, 0)}%`);
};

const throughput = async (rounds: number, rules: RulesInput = {}): Promise<void> => {
  const rows = [];
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const supply = looseMaterial(generateWorld(seed, rules));
    const { world, events, scores } = await playMatch({
      seed,
      rounds,
      rules,
      players: [{ id: 'player-1', bot: 'expander' }],
      bots: archetypes,
    });
    const moves = events.filter((event) => event.type === 'android.move').length;
    const androids = world.androids.filter((a) => a.ownerId === 'player-1');
    rows.push({
      collected: supply - looseMaterial(world),
      supply,
      moves,
      score: scores[0]?.total ?? 0,
      fleet: androids.filter((a) => a.active).length,
      health: mean(androids.map((a) => a.health)),
    });
  }
  const collected = mean(rows.map((r) => r.collected));
  const fleet = mean(rows.map((r) => r.fleet));
  console.log(`== what a turn earns (${rounds} rounds, ${SEEDS} seeds) ==`);
  console.log(
    `  ${fmt(collected / rounds / Math.max(1, fleet), 2)} units per android-turn  ${fmt((mean(rows.map((r) => r.moves)) / rounds / Math.max(1, fleet)) * 100, 0)}% of turns spent moving`,
  );
  console.log(
    `  loose pool ${fmt(mean(rows.map((r) => r.supply)), 0)}, of which ${fmt((collected / mean(rows.map((r) => r.supply))) * 100, 0)}% was ever picked up`,
  );
  console.log(`  fleet ${fmt(fleet, 1)}  end health ${fmt(mean(rows.map((r) => r.health)), 0)}`);
};

const milestones = async (rounds: number, rules: RulesInput = {}): Promise<void> => {
  const firsts: Record<string, number[]> = {};
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    const { events } = await playMatch({
      seed,
      rounds,
      rules,
      players: [{ id: 'player-1', bot: 'industrialist' }],
      bots: archetypes,
    });
    let round = 0;
    const seen = new Set<string>();
    for (const event of events) {
      if (event.type === 'game.round-start') {
        round += 1;
      }
      const label =
        event.type === 'android.start-construction'
          ? event.buildingType
          : event.type === 'android.launch'
            ? 'second android'
            : undefined;
      if (label && !seen.has(label)) {
        seen.add(label);
        firsts[label] = [...(firsts[label] ?? []), round];
      }
    }
  }
  console.log(`== when each phase happens (${rounds} rounds, industrialist) ==`);
  for (const [label, landed] of Object.entries(firsts)) {
    console.log(
      `  ${label.padEnd(16)} round ${fmt(mean(landed), 0).padStart(3)}  (in ${landed.length}/${SEEDS} games)`,
    );
  }
};

type Standing = { wins: number; played: number; points: number[]; industry: number };

/** One pairing on one seed, recorded into both players' standings. */
const playPairing = async (options: {
  left: string;
  right: string;
  seed: number;
  rounds: number;
  rules: RulesInput;
  table: Record<string, Standing>;
}): Promise<void> => {
  const { left, right, seed, rounds, rules, table } = options;
  const { world, scores } = await playMatch({
    seed,
    rounds,
    rules,
    players: [
      { id: 'player-1', bot: left },
      { id: 'player-2', bot: right },
    ],
    bots: archetypes,
  });
  const scoreOf = (id: string): number => scores.find((score) => score.playerId === id)?.total ?? 0;
  const industryOf = (id: string): number =>
    world.buildings.filter((b) => b.ownerId === id && b.remainingConstruction.ticks === 0 && INDUSTRY.includes(b.type))
      .length;
  const [a, b] = [scoreOf('player-1'), scoreOf('player-2')];

  for (const [name, id, score] of [
    [left, 'player-1', a],
    [right, 'player-2', b],
  ] as const) {
    const row = table[name];
    if (row) {
      row.played += 1;
      row.points.push(score);
      row.industry += industryOf(id);
    }
  }
  const winner = a === b ? undefined : table[a > b ? left : right];
  if (winner) {
    winner.wins += 1;
  }
};

const tournament = async (rounds: number, rules: RulesInput = {}): Promise<void> => {
  const table: Record<string, Standing> = {};
  for (const name of FIELD) {
    table[name] = { wins: 0, played: 0, points: [], industry: 0 };
  }

  for (const left of FIELD) {
    for (const right of FIELD) {
      if (left >= right) {
        continue;
      }
      for (let seed = 1; seed <= SEEDS; seed += 1) {
        await playPairing({ left, right, seed, rounds, rules, table });
      }
    }
  }

  console.log(`== is one strategy the answer? (${rounds} rounds, ${SEEDS} seeds per pairing) ==`);
  const rows = Object.entries(table).sort((l, r) => r[1].wins / r[1].played - l[1].wins / l[1].played);
  for (const [name, row] of rows) {
    console.log(
      `  ${name.padEnd(14)} won ${fmt((row.wins / row.played) * 100, 0).padStart(3)}% of ${row.played}  mean score ${fmt(mean(row.points), 0).padStart(4)} (sd ${fmt((stdev(row.points) / Math.max(1, mean(row.points))) * 100, 0)}%)  industry ${fmt(row.industry / row.played, 1)}`,
    );
  }
  const shares = rows.map(([, row]) => row.wins / row.played);
  const best = Math.max(...shares);
  console.log(
    `  => best ${fmt(best * 100, 0)}%, worst ${fmt(Math.min(...shares) * 100, 0)}%. ${
      best > 0.75 ? 'One strategy is close to being the answer.' : 'No single answer.'
    }`,
  );
};

console.log(process.env.RULES ? `measuring ${process.env.RULES}\n` : 'measuring the shipped game\n');
census(OVERRIDES);
console.log('');
await throughput(100, OVERRIDES);
console.log('');
await milestones(120, OVERRIDES);
console.log('');
await tournament(60, OVERRIDES);
console.log('');
await tournament(120, OVERRIDES);
