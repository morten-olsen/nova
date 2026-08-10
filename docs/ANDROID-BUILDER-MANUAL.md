# Android Builder Manual

An Android is a small JavaScript program that chooses exactly one action each turn. You are building a policy, not issuing a sequence of manual orders. Start with a dependable behavior, simulate it, then use the recording to improve it.

## Script contract

The script runs in a sandbox with four globals:

- `androidId`: the id of the Android whose turn is running.
- `world`: a fogged snapshot of the current world. It contains only tiles revealed for this Android's owner, plus the Android's current tile. Androids, buildings, and broadcasts outside those tiles are omitted.
- `turn`: the turn now being played, counting from 1.
- `finalTurn`: the turn the match is scheduled to end on, or `undefined` when it has no scheduled end. Compare it against `turn` to know how much time is left — but check for `undefined` first, because most matches do not set one.

Return one valid action object. For example:

```js
({ type: 'android.move', direction: 'east' });
```

Scripts can persist state by optionally including `memory` and `recording` strings on that action. Both updates happen with the action and do not consume an additional turn. `memory` is a private working state (maximum 4,096 characters) for decisions across turns. `recording` is a player-facing log (maximum 16,384 characters) retained on the Android after it is deactivated. Each value replaces the previous value, so read the current Android's value from `world.androids` when appending to a recording. The `memory` and `recording` of every other Android are `[Redacted]`.

```js
const android = world.androids.find((candidate) => candidate.id === androidId);
({
  type: 'android.move',
  direction: 'east',
  memory: JSON.stringify({ destination: { x: 4, y: 2 } }),
  recording: `${android?.recording ?? ''}Moved east.\n`,
});
```

Scripts cannot import modules, read files, make network calls, or retain state between turns. Derive decisions from the visible part of `world`, including Android position, cargo, buildings, tiles, and messages. Do not treat a missing tile or entity as proof that it does not exist; it may be in the fog. See the rulebook for every action and its required fields.

The action you return travels back as JSON, so it must be a plain object. Values JSON cannot carry — functions, class instances, circular references — fail the turn.

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

Use `bot/starter-builder.js` as a starting point. Its broad loop is:

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
- A failed action can deactivate an Android for that turn. Do not blindly move beyond the map boundary.

## Evolve, do not overwrite blindly

Give every meaningful change a new script name and upload it. Existing Androids keep their old script version, so the simulation can contain multiple generations at once. This makes it possible to compare policies, but capacity comes from completed chargers, so dismantle obsolete Androids or build capacity when necessary.

The rulebook is the player-facing contract. When its wording does not answer an implementation question, inspect `node_modules/@morten-olsen/nova-game/src/` to understand the current engine. Do not import those files from a bot: they are reference material, not part of the sandbox API.
