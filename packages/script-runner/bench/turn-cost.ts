/**
 * What a turn actually costs, and what the limit defaults are worth.
 *
 * Run with `pnpm --filter @morten-olsen/nova-script-runner bench`. The numbers
 * that matter: loading the WebAssembly module dominates everything else by two
 * orders of magnitude, which is the entire reason the module is cached and
 * warmed up rather than built per turn — and why building a *runtime* per turn,
 * for per-turn memory and CPU accounting, costs almost nothing.
 */

import { readFile } from 'node:fs/promises';

// From the build rather than from source: Node's type stripping does not
// resolve the `.js` specifiers the sources use, so `pnpm bench` builds first.
import { defaultRules } from '@morten-olsen/nova-game';

import { loadQuickJs, runInSandbox, resolveLimits } from '../dist/nova-script-runner.js';

const world = {
  scripts: [],
  tiles: Array.from({ length: 400 }, (_, index) => ({
    position: { x: index % 20, y: Math.floor(index / 20) },
    composition: { metal: 4, silicon: 2 },
  })),
  androids: Array.from({ length: 8 }, (_, index) => ({
    id: `android-${index + 1}`,
    ownerId: 'player-1',
    scriptId: 'script-1',
    position: { x: index, y: 0 },
    battery: 100,
    health: 100,
    active: true,
    cargo: {},
  })),
  buildings: [],
  round: 1,
};

const inputJson = JSON.stringify({
  androidId: 'android-1',
  world,
  rules: defaultRules,
  turn: 1,
  finalTurn: undefined,
});
const limits = resolveLimits(defaultRules);

const time = (label: string, iterations: number, body: () => void): void => {
  const started = performance.now();
  for (let index = 0; index < iterations; index += 1) {
    body();
  }
  const total = performance.now() - started;
  console.log(`${label.padEnd(46)} ${(total / iterations).toFixed(3)} ms/turn  (${iterations} runs)`);
};

const loadStarted = performance.now();
const module = await loadQuickJs();
console.log(
  `${'load the WebAssembly module (once per process)'.padEnd(46)} ${(performance.now() - loadStarted).toFixed(1)} ms`,
);

const starterBot = await readFile(new URL('../../../docs/examples/starter-builder.js', import.meta.url), 'utf8');

time('empty turn (runtime + context + teardown)', 200, () => {
  runInSandbox(module, { androidId: 'android-1', content: "({ type: 'android.wait' })", inputJson, limits });
});

time('starter bot, 400 tiles / 8 androids', 200, () => {
  runInSandbox(module, { androidId: 'android-1', content: starterBot, inputJson, limits });
});

// How much wall clock the CPU default is worth on this machine, and how much of
// it a legitimate turn spends. A default that a real bot can reach by accident
// would be worse than no default at all.
const spinStarted = performance.now();
const spun = runInSandbox(module, { androidId: 'android-1', content: 'while (true) {}', inputJson, limits });
console.log(
  `${`${limits.fuel}-tick CPU budget, spent spinning`.padEnd(46)} ${(performance.now() - spinStarted).toFixed(1)} ms` +
    `  (${spun.ok ? 'completed?!' : 'interrupted'})`,
);
