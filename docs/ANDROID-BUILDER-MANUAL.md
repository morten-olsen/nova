# Android Builder Manual

An Android is a small TypeScript program that chooses exactly one action each turn. You are building a policy, not issuing a sequence of manual orders. Start with a dependable behavior, simulate it, then use the recording to improve it.

## Script contract

An Android is a module whose default export is its turn function. That function is called once per round and returns that round's action:

```ts
const turn: AndroidTurn = () => ({ type: 'android.move', direction: 'east' });
export default turn;
```

It runs in a sandbox with four globals:

- `androidId`: the id of the Android whose turn is running.
- `world`: a fogged snapshot of the current world. It contains only tiles revealed for this Android's owner, plus the Android's current tile. Androids, buildings, and broadcasts outside those tiles are omitted.
- `turn`: the turn now being played, counting from 1.
- `finalTurn`: the turn the match is scheduled to end on, or `undefined` when it has no scheduled end. Compare it against `turn` to know how much time is left — but check for `undefined` first, because most matches do not set one.

Scripts can persist state by optionally including `memory` and `recording` strings on that action. Both updates happen with the action and do not consume an additional turn. `memory` is a private working state (maximum 4,096 characters) for decisions across turns. `recording` is a player-facing log (maximum 16,384 characters) retained on the Android after it is deactivated. Each value replaces the previous value, so read the current Android's value from `world.androids` when appending to a recording. The `memory` and `recording` of every other Android are `[Redacted]`.

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

Types come from the game. `Action`, `World`, `Tile`, `Android` and the rest are in scope without an import, as are the four globals, because the factory's `tsconfig.json` points at the engine's declarations:

```json
"types": ["@morten-olsen/nova-game/android"]
```

They are the engine's own types rather than a copy, so an action added to the game is offered by the editor as soon as the package is updated. Run `npm run check` in a factory to type-check every Android without playing one.

Import _types_ from `@morten-olsen/nova-game` if you want to name one explicitly, never values: the package is the engine itself, and bundling it into an Android would spend the turn budget on loading it.

## Sandbox and limits

Scripts run in QuickJS, the same interpreter in the browser IDE and in the CLI, so a bot that works in one behaves identically in the other. It is a standards-compliant JavaScript engine, but it is not a browser and it is not Node: there is no `console`, no `fetch`, no `window`, no `process`, and no timers.

Each turn gets its own interpreter with its own budget, and a turn that exceeds any of them fails that turn without affecting the next one:

| Limit      | Default                                       | What exhausts it                                                      |
| ---------- | --------------------------------------------- | --------------------------------------------------------------------- |
| CPU        | 10,000 ticks (roughly 100 million operations) | Infinite loops, and searches that never terminate                     |
| Wall clock | 1 second                                      | Work that is slow without being long, such as allocating relentlessly |
| Memory     | 16 MB                                         | Building enormous arrays or strings                                   |
| Call stack | 128 KB                                        | Unbounded recursion                                                   |

The CPU budget is counted in interpreter ticks rather than milliseconds, so a script is cut off at the same point on every machine — which is what lets two peers replay the same match and agree on the outcome. A normal bot is nowhere near any of these; the shipped starter builder finishes a turn without spending a single tick.

## Recommended first strategy

Use `bot/starter-builder.ts` as a starting point. Its broad loop is:

1. Find the current Android and tile.
2. Finish owned construction on its tile.
3. Build a charger or depot when the carried resources permit it.
4. Charge on an owned charger before the battery becomes unsafe.
5. Collect loose material when possible.
6. Move toward the nearest remaining loose material.

That is intentionally simple. Improve it by making one observable decision at a time: return cargo to a depot, avoid hazardous tiles, choose a better construction site, or assign Androids specialized roles.

## Build reliable policies

- Put defensive checks first: missing Android, inactive Android, absent tile, or no valid target should produce `android.wait` rather than an invalid action.
- Use Manhattan distance (`abs(dx) + abs(dy)`) to select nearby grid targets.
- Respect cargo capacity (10 units), battery, health, map edges, and one-building-per-tile rules.
- Prefer collecting material into cargo before starting construction. Construction consumes supplied resources.
- Check the tile's `composition` for acid and radiation before treating it as safe. Loose `scattered` material and ground composition are different resources.
- A failed action costs the turn and `10` health. A single mistake is survivable, but a policy that fails every round destroys the Android in ten. Do not blindly move beyond the map boundary.
- `world.androids` includes deactivated wrecks on tiles you can see. Filter on `active` when you count Androids or pick a target.

## Evolve, do not overwrite blindly

Give every meaningful change a new script name and upload it. Existing Androids keep their old script version, so the simulation can contain multiple generations at once. This makes it possible to compare policies, but capacity comes from completed chargers, so dismantle obsolete Androids or build capacity when necessary.

## Grow and retire the fleet from a charger

An Android standing on one of its owner's completed chargers is at a deployment bay, and can manage the fleet without the player intervening:

- `({ type: 'android.launch', scriptId })` launches a sibling on that charger, running any of the owner's scripts in `world.scripts`.
- `({ type: 'android.dismantle', targetAndroidId })` retires another of the owner's Androids, wherever it stands.

Both are held to the rules a player launch is held to. A launch needs spare capacity — the owner's active Androids must number fewer than their completed chargers — and because the launching Android is itself active, one charger is never enough to launch from. A dismantle can only target the same owner's Androids, and never the Android acting: to self-destruct, omit `targetAndroidId`.

This makes a self-sustaining fleet possible: a script that builds chargers can fill them, and one that recognizes an obsolete generation can retire it. Count capacity from `world.buildings` before launching — a refused launch is a failed turn, which costs the Android that tried its round and `10` health. A newly launched Android takes its first turn in the following round.

The rulebook is the player-facing contract. When its wording does not answer an implementation question, inspect `node_modules/@morten-olsen/nova-game/src/` to understand the current engine. Do not import those files from a bot: they are reference material, not part of the sandbox API.
