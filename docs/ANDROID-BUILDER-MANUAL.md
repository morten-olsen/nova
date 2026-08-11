# Android Builder Manual

An Android is a small TypeScript program that chooses exactly one action each turn. You are building a policy, not issuing a sequence of manual orders. Start with a dependable behavior, simulate it, then use the recording to improve it.

## Script contract

An Android is a module whose default export is its turn function. That function is called once per round and returns that round's action:

```ts
const turn: AndroidTurn = () => ({ type: 'android.move', direction: 'east' });
export default turn;
```

It runs in a sandbox with five globals:

- `androidId`: the id of the Android whose turn is running.
- `world`: a fogged snapshot of the current world. It contains only tiles revealed for this Android's owner, plus the Android's current tile. Androids, buildings, and broadcasts outside those tiles are omitted.
- `rules`: every number this game is played with — see [Read the rules, do not repeat them](#read-the-rules-do-not-repeat-them).
- `turn`: the turn now being played, counting from 1.
- `finalTurn`: the turn the humans are expected to land on, or `undefined` when the game has no arrival date. Compare it against `turn` to know how much time is left — but check for `undefined` first, because an open-ended game does not set one. See [Play to the arrival date](#play-to-the-arrival-date).

Scripts can persist state by optionally including `memory` and `recording` strings on that action. Both updates happen with the action and do not consume an additional turn. `memory` is a private working state (`rules.android.memoryLimit` characters, 4,096 by default) for decisions across turns. `recording` is a player-facing log (`rules.android.recordingLimit` characters, 16,384 by default) retained on the Android after it is deactivated. Writing past either limit is a refused action, so it fails the turn like any other. Each value replaces the previous value, so read the current Android's value from `world.androids` when appending to a recording. The `memory` and `recording` of every other Android are `[Redacted]`.

```ts
const turn: AndroidTurn = () => {
  const android = world.androids.find((candidate) => candidate.id === androidId);
  return {
    type: 'android.move',
    direction: 'east',
    memory: JSON.stringify({ destination: { x: 4, y: 2 } }),
    recording: `${android?.recording ?? ''}Moved east.\n`,
  };
};
export default turn;
```

A running script cannot import modules, read files, make network calls, or retain state between turns. Derive decisions from the visible part of `world`, including Android position, cargo, buildings, tiles, and messages. Do not treat a missing tile or entity as proof that it does not exist; it may be in the fog. See the rulebook for every action and its required fields.

The action you return travels back as JSON, so it must be a plain object. Values JSON cannot carry — functions, class instances, circular references — fail the turn.

## TypeScript, and more than one file

Nothing is compiled while an Android plays. Both places an Android is written compile it first, and hand the sandbox the JavaScript that comes out.

The browser lab compiles the one file it is editing. The CLI also bundles: `upload-script`, `host` and `join` follow the imports of the file you point them at, so an Android in a factory can be as many files as it needs, and adding the first import to a working Android changes nothing about how it runs.

```ts
import { chooseTarget } from './lib/targets.js';

const turn: AndroidTurn = () => ({ type: 'android.move', direction: chooseTarget() });
export default turn;
```

There is exactly one shape, and no exception for the simple case. An Android that ends in a bare action expression is refused, in the lab and in the CLI, with the change it needs — because the alternative is a file that means one thing until you import something and another thing afterwards, and that failure would arrive as an Android that waits every round rather than as an error.

Older Androids, written before this, end in a bare action expression. To bring one forward, put its body in a turn function, `return` where it used to end in an expression, and export the function.

Types come from the game. `Action`, `World`, `Tile`, `Android`, `Rules` and the rest are in scope without an import, as are the five globals, because the factory's `tsconfig.json` points at the engine's declarations:

```json
"types": ["@morten-olsen/nova-game/android"]
```

They are the engine's own types rather than a copy, so an action added to the game is offered by the editor as soon as the package is updated. Run `npm run check` in a factory to type-check every Android without playing one.

Import _types_ from `@morten-olsen/nova-game` if you want to name one explicitly, never values: the package is the engine itself, and bundling it into an Android would spend the turn budget on loading it.

## Sandbox and limits

Scripts run in QuickJS, the same interpreter in the browser IDE and in the CLI, so a bot that works in one behaves identically in the other. It is a standards-compliant JavaScript engine, but it is not a browser and it is not Node: there is no `console`, no `fetch`, no `window`, no `process`, and no timers.

Each turn gets its own interpreter with its own budget, and a turn that exceeds any of them fails that turn without affecting the next one. Three of the four are rules, so a script can read its own allowance instead of assuming these numbers:

| Limit      | Rule                       | Default                                       | What exhausts it                                                      |
| ---------- | -------------------------- | --------------------------------------------- | --------------------------------------------------------------------- |
| CPU        | `rules.script.fuel`        | 10,000 ticks (roughly 100 million operations) | Infinite loops, and searches that never terminate                     |
| Wall clock | `rules.script.timeoutMs`   | 1 second                                      | Work that is slow without being long, such as allocating relentlessly |
| Memory     | `rules.script.memoryBytes` | 16 MB                                         | Building enormous arrays or strings                                   |
| Call stack | —                          | 128 KB                                        | Unbounded recursion                                                   |

The CPU budget is counted in interpreter ticks rather than milliseconds, so a script is cut off at the same point on every machine — which is what lets two peers replay the same match and agree on the outcome. A normal bot is nowhere near any of these; the shipped starter builder finishes a turn without spending a single tick.

A bot that wants to plan expensively — a flood fill, a route search over every revealed tile — should size that work from `rules.script` rather than from this table, because a host can tighten the budgets as easily as it can loosen them:

```ts
// Scale the search to the game's budget instead of hoping 5,000 nodes fit.
const nodeBudget = Math.floor(rules.script.fuel / 4);
```

The call stack is the exception: it is not a rule, because its ceiling is a property of the WebAssembly build rather than a design choice. Write iteratively where a recursion could get deep.

## Read the rules, do not repeat them

The `rules` global holds every number the game is being played with: cargo
capacity, battery costs, hazard damage, build costs and construction times, sight
ranges, salvage rates, what scores, and the board's `width` and `height`. The
rulebook states the defaults, but a host can retune any of them, and a game file
carries whatever it was created with.

So read them:

```ts
const capacity = rules.android.cargoCapacity;
const depotCost = rules.buildings.depot.cost;
const chargePerVisit = rules.buildings.charger.charge;
const onMap = (p: Position): boolean => p.x >= 0 && p.y >= 0 && p.x < rules.world.width && p.y < rules.world.height;
```

Three things this buys, all of them visible in `bot/starter-builder.ts`:

- **The map's bounds are knowable.** The fog hides what is _on_ a tile, never how
  big the planet is. `rules.world` gives the edge directly, so nothing has to be
  inferred from a neighbour that is missing — which is the same thing a tile in
  the fog looks like.
- **Costs and capacities stop being magic numbers.** `affordable(rules.buildings.depot.cost)`
  keeps working when a depot's price changes; `metal >= 6` does not.
- **Weighing hazards becomes arithmetic.** Acid costs
  `rules.android.acidDamagePerPoint` per point and radiation
  `rules.android.radiationDamagePerPoint`, so a route can be scored by what it
  actually costs this Android rather than by a remembered ratio.

Every value is resolved: nothing in `rules` is optional or absent, so there is no
default to fill in. Treat it as read-only — writing to it changes nothing outside
your own turn.

## Play to the arrival date

`turn` is the round being played. `finalTurn` is the round the humans are expected
to land on — the game's deadline — and it is the one global that may be
`undefined`, so check before using it.

Nothing mechanical happens on that round: the engine does not stop the game, and
readiness is scored from the world continuously. What it tells you is how much
time the colony has left, and a good policy is not the same at both ends of it:

- **Early**, with many turns left, investment pays. Explore, clean acid, build
  chargers to grow the fleet, start the expensive buildings — a depot begun now
  is finished long before the deadline.
- **Late**, with few turns left, only what completes counts. Do not start
  construction that cannot finish, and bank what you are carrying instead of
  prospecting for more.

Starting a building costs the turn it is started on, and each `ticks` after that
is one `android.continue-construction`, so a site begun on `turn` completes on
`turn + rules.buildings[type].ticks` at the earliest:

```ts
const turnsLeft = finalTurn === undefined ? Infinity : finalTurn - turn;
const canFinish = (type: BuildingType): boolean => rules.buildings[type].ticks <= turnsLeft;
```

Two ways of playing set the arrival for you, because in both the round count is a
real deadline that cannot be extended afterwards:

- A peer match — `nova host --rounds 20`, or Match › Host in the browser lab —
  where it is the round count the host offered.
- A run in the browser lab, where it is the round count in the Run panel.
  Changing it and running again is how an endgame is tested.

A game file made with `nova create-game` has no arrival unless its rules file sets
`match.finalRound`, because `nova run` can always be asked for more rounds. Write
the bot so `undefined` means "play as though there is time", and it works in both.

## Recommended first strategy

Use `bot/starter-builder.ts` as a starting point. Its broad loop is:

1. Find the current Android and tile.
2. Finish owned construction on its tile.
3. Build a charger or depot when the carried resources permit it.
4. Charge on an owned charger before the battery becomes unsafe.
5. Collect loose material when possible.
6. Move toward the nearest remaining loose material.

Every quantity it uses comes from `rules`, and the handful of numbers written into
the file are policy rather than rules — how much battery margin to keep, when to
top up, how many rounds of log to retain. That split is worth keeping as you edit
it: if a number describes the game, read it; if it describes your strategy, name
it and own it.

That is intentionally simple. Improve it by making one observable decision at a time: return cargo to a depot, avoid hazardous tiles, choose a better construction site, or assign Androids specialized roles.

## Build reliable policies

- Put defensive checks first: missing Android, inactive Android, absent tile, or no valid target should produce `android.wait` rather than an invalid action.
- Use Manhattan distance (`abs(dx) + abs(dy)`) to select nearby grid targets.
- Respect cargo capacity (`rules.android.cargoCapacity`), battery, health, the map edges (`rules.world.width` and `rules.world.height`), and one-building-per-tile rules.
- Prefer collecting material into cargo before starting construction. Construction consumes supplied resources.
- Check the tile's `composition` for acid and radiation before treating it as safe. Loose `scattered` material and ground composition are different resources.
- A failed action costs the turn and `rules.android.failedTurnHealthPenalty` health. A single mistake is survivable, but a policy that fails every round destroys the Android in ten. Do not blindly move beyond the map boundary.
- `world.androids` includes deactivated wrecks on tiles you can see. Filter on `active` when you count Androids or pick a target.

## Evolve, do not overwrite blindly

Give every meaningful change a new script name and upload it. Existing Androids keep their old script version, so the simulation can contain multiple generations at once. This makes it possible to compare policies, but capacity comes from completed chargers, so dismantle obsolete Androids or build capacity when necessary.

## Grow and retire the fleet from a charger

An Android standing on one of its owner's completed chargers is at a deployment bay, and can manage the fleet without the player intervening:

- `({ type: 'android.launch', scriptId })` launches a sibling on that charger, running any of the owner's scripts in `world.scripts`.
- `({ type: 'android.dismantle', targetAndroidId })` retires another of the owner's Androids, wherever it stands.

Both are held to the rules a player launch is held to. A launch needs spare capacity — the owner's active Androids must number fewer than the capacity their completed buildings carry, which is `rules.buildings[type].androidCapacity` summed, one per charger by default — and because the launching Android is itself active, one charger is never enough to launch from. A dismantle can only target the same owner's Androids, and never the Android acting: to self-destruct, omit `targetAndroidId`.

This makes a self-sustaining fleet possible: a script that builds chargers can fill them, and one that recognizes an obsolete generation can retire it. Count capacity from `world.buildings` and `rules.buildings` before launching — a refused launch is a failed turn, which costs the Android that tried its round and `rules.android.failedTurnHealthPenalty` health. A newly launched Android takes its first turn in the following round.

The rulebook is the player-facing contract. When its wording does not answer an implementation question, inspect `node_modules/@morten-olsen/nova-game/src/` to understand the current engine. Do not import those files from a bot: they are reference material, not part of the sandbox API.
