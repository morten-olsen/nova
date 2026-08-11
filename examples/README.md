# Project Nova examples

## Starter builder android

`docs/examples/starter-builder.ts` is a small rulebook-aware starter android. It default-exports its turn function, as every android does, and uses the script globals:

- `world` — the current world snapshot
- `androidId` — the android executing the script
- `rules` — every number this game is played with

The android demonstrates the current base ruleset by:

- collecting scattered earth-launched material
- building and finishing a depot
- collecting enough metal for an extra charger
- building and finishing that charger
- recharging when it returns to owned charger infrastructure

Not one game constant is written into it. Cargo capacity, build costs, the board's
bounds, what a charge is worth and what a hazard costs are all read from `rules`,
so the same file plays a retuned game correctly — which is also why it survives
the 3x3 board its tests put it on.

Recreate the committed sample recording with:

```sh
pnpm nova init --file examples/games/starter-builder-sample.json --width 6 --height 6
pnpm nova upload-script --file examples/games/starter-builder-sample.json --owner player-1 --name starter-builder --script docs/examples/starter-builder.ts
pnpm nova launch-android --file examples/games/starter-builder-sample.json --owner player-1 --script-id script-1
pnpm nova run --file examples/games/starter-builder-sample.json --rounds 35
pnpm nova status --file examples/games/starter-builder-sample.json
```

The committed sample game has run 35 rounds on a 6x6 world. Like every game file
it stores the rules it was created with, so `status`, `run` and `play` all
continue it under the same numbers — pass `--rules rules.json` to `create-game` to
try a retuned one.

## Later-stage tabletop scenario

`examples/games/later-stage-tabletop-sample.json` is a deterministic 14x12 visualizer scenario that begins in round 82 with two established colony programs. It includes 6 active androids, 14 buildings across both players, active construction, extractors/processors, chargers, scanners, a relay, loose material caches, and a short movement sequence for testing renderer animations.

Regenerate it with:

```sh
python3 examples/games/generate-later-stage-sample.py
pnpm nova status --file examples/games/later-stage-tabletop-sample.json
```

## Trailer scenarios

`examples/games/trailer-first-light.json` and
`examples/games/trailer-colony-race.json` are the two recordings the store
trailer is cut from. They are ordinary recordings — open either in the viewer —
but they are choreographed rather than simulated, so that specific rules land on
specific rounds.

| File                       | Board | Rounds | Designed to show                                                                                                                            |
| -------------------------- | ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `trailer-first-light.json` | 12x9  | 0–19   | The smallest complete loop: an unexplored board, fog opening around one Android, a pod field, a first depot, a broadcast.                   |
| `trailer-colony-race.json` | 16x12 | 46–66  | Two colony programs; an Android killed by acid, a scanner lost to hostile salvage, the flats being cleaned, and a colony module completing. |

Regenerate both with:

```sh
pnpm build
pnpm trailer:scenarios
pnpm nova status --file examples/games/trailer-colony-race.json
```

The generator replays every event through `createBaseRuleset` while writing, so
these files cannot contain a move the rules reject, and it asserts the beats
afterwards — the colony module completes, the scanner is salvaged before the
climax, the acid kills before the sabotage, and Aurora starts behind on
readiness and finishes ahead. The scenario sources live in
`apps/trailer/src/scenarios`; see [`apps/trailer/README.md`](../apps/trailer/README.md).
