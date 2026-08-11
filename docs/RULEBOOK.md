# Project: Nova Rulebook

Project: Nova is a programming strategy game about preparing a hostile planet for human colonization. Players do not directly command units during play. Instead, each player writes android programs, uploads them as scripts, launches androids, and studies the resulting simulation to improve later script versions.

This rulebook is written for players and coding agents that want to play the current game.

**Every number in this document is a default.** They are all rules — data, not code — and a host can retune any of them for a given game. Each one below is named with the rule it comes from, such as `rules.android.cargoCapacity`, and an Android reads the resolved values at run time from the `rules` global. See [Rules](#18-rules) for the whole table and how to change it. Where this rulebook states a number, read it as "the shipped default"; where a script needs the truth, read `rules`.

## 1. Objective

Only one player can become the planet's founding colony authority.

Colony readiness is scored continuously from the current world state. Players prepare a viable colony through completed infrastructure, secured material, environmental preparation, and reliable resource supply. Discovery and other information-gathering are useful for play, but do not themselves earn readiness points.

A good android strategy should focus on:

- finding scattered earth-launched material
- building chargers to increase android capacity
- building storage and resource infrastructure
- avoiding or cleaning hazards
- keeping androids charged and alive
- leaving useful broadcasts and recordings for future script improvements

## 2. Core Loop

Players repeat this loop:

1. Write or update android code.
2. Upload the code as an android script version.
3. Launch androids using available charger capacity.
4. Run the simulation.
5. Review the recording, messages, and world state.
6. Improve future android behavior.

Androids are autonomous once launched. A script is a module whose default export is its turn function, called once per round and returning that round's action:

```ts
const turn: AndroidTurn = () => ({ type: 'android.move', direction: 'east' });
export default turn;
```

The turn function runs with these globals:

- `androidId` — the id of the android currently taking its turn
- `world` — the fogged world snapshot visible to the script runner
- `rules` — every number this game is played with (see [Rules](#18-rules))
- `turn` — the round now being played, counting from 1
- `finalTurn` — the round the match is scheduled to end on, or `undefined`

The scripts stored in a game are the compiled result. A factory Android is written in TypeScript, across as many files as it needs, and the CLI compiles and bundles it into one script on upload. The action shapes below are what the turn function returns.

## 3. World

The planet is a rectangular grid of tiles.

Each tile has:

- `position`: `{ x, y }`
- `composition`: materials and hazards in the ground
- `scattered`: loose earth-launched material on the surface
- optional `revealedBy`: player ids that can **currently** see the tile

The board's size is `rules.world.width` x `rules.world.height` — 16 x 16 by default — and a script can read it even though the tiles themselves are fogged.

Tile composition is generated randomly when a new map is created, from `rules.world.generation`. Composition is not the same as loose material. Composition represents things in the ground or environmental conditions.

Current composition fields:

- `ore` — natural material that extractors can harvest
- `water` — natural material that extractors can harvest
- `acid` — environmental hazard and extractable/processable material
- `radiation` — environmental hazard

Current scattered material fields:

- `metal`
- `electronics`
- `polymer`
- `ore`
- `water`
- `acidCanister`

Scattered material can be collected directly by androids. Composition cannot be collected directly; it requires buildings or special mechanics.

A tile can contain at most one building or construction site.

## 4. Players

Players are competitors. There are no formal alliances, shared ownership rules, shared victory, or safe teammate permissions.

A player is created when they first upload a script or launch an android. Each player is guaranteed an initial charger. Initial chargers are completed, owned by that player, and cannot be salvaged.

## 5. Androids

Androids are programmable autonomous units.

Current android fields include:

- `id`
- `ownerId`
- `scriptId`
- `position`
- `battery`
- `health`
- `active`
- optional `cargo`
- `memory` — private persistent working state, limited to `rules.android.memoryLimit` characters (4,096)
- `recording` — player-facing persistent log, limited to `rules.android.recordingLimit` characters (16,384)

Androids can currently:

- move one tile orthogonally
- collect scattered material from their current tile
- carry up to `rules.android.cargoCapacity` total material units (10)
- start and continue construction
- charge on owned chargers
- deposit to and withdraw from storage-capable owned buildings
- salvage buildings
- broadcast public messages
- clean acid from adjacent tiles if their owner has an acid processing plant
- launch another android of the same owner while standing on an owned completed charger
- dismantle themselves, or another android of the same owner while standing on an owned completed charger

Androids have health. They lose a small amount of health over time. Environmental hazards can damage them faster.

At round end:

- every android loses `rules.android.decayPerRound` health from ordinary decay (`0.1`)
- radiation damages androids by `radiation * rules.android.radiationDamagePerPoint` (`0.25`)
- acid damages androids by `acid * rules.android.acidDamagePerPoint` (`0.5`)

A failed turn — a refused action, a script error, an exhausted turn budget — costs the android `rules.android.failedTurnHealthPenalty` health (`10`) on top of the round it lost. One bad edge case is survivable; a script that keeps making the same mistake wears its android out.

Androids with health at or below 0, or battery at or below 0, are destroyed at round end. A destroyed android is deactivated rather than removed: it takes no further turns and no longer holds charger capacity, but it stays in the world as a wreck, so its owner can still read the `memory` and `recording` it left behind. Deactivated androids take no further decay or hazard damage, and are not drawn on the board.

## 6. Chargers and Android Capacity

Chargers determine android deployment capacity.

A player's active android cap is the sum of `rules.buildings[type].androidCapacity` over their completed buildings. Only chargers carry capacity by default, and each carries 1, so the cap is the number of completed chargers they own.

Examples:

- 1 charger allows 1 active android
- 3 chargers allow 3 active androids

A player always has at least their initial charger. Initial chargers are placed on non-overlapping tiles when the world is set up.

If a non-initial charger is destroyed or salvaged, the player's deployment cap immediately decreases. Existing androids are not automatically destroyed, but the player cannot launch more androids until their active android count is below the current cap.

Launching is currently immediate if capacity is available. Launch delay is planned but not implemented yet.

A player is not the only one who can spend that capacity. An android standing on one of its owner's completed chargers can launch a sibling itself with `android.launch`, and it is held to the same cap: the launch is refused unless the owner's active android count is below their completed charger count. Because the launching android is itself active, a player with a single charger can never have their android launch another.

## 7. Scripts, Launching, and Dismantling

Players may upload improved script versions during the game. Existing androids do not automatically update to a new script.

To use a new script version, a player must launch a new android with that script id, or dismantle/free capacity and launch a replacement.

Dismantling is voluntary. It deactivates the android and frees charger capacity. It currently returns no material. As with any destroyed android, the dismantled one stays in the world as a wreck.

An android on one of its owner's completed chargers can also dismantle another android of the same owner, so a fleet can retire and replace its own members without the player intervening. An android can never dismantle another player's android, and can never name itself as the target — self-destruction is the untargeted form of the same action.

## 8. Android Action API

An android script's turn function must return one android event. The engine adds `androidId` automatically. Every action may also include optional `memory` and `recording` string fields. They replace the Android's previous values as part of the same turn; they are not separate actions. Scripts can read both values from their Android in `world.androids`. `memory` is for operational state across turns. `recording` is the log available to the player after the Android is deactivated.

Because both fields are written as part of the action, a rejected action takes them with it: if the action is refused — moving outside the map, building without the material, writing past the `memory` limit — the turn becomes a failed turn, the Android loses `rules.android.failedTurnHealthPenalty` health, and neither `memory` nor `recording` is updated for that round. An Android that needs a reliable log should prefer an action it knows will be accepted over an ambitious one that may be refused.

In a peer match played with `--disclosure recording` (see the [CLI guide](CLI-GUIDE.md#play-another-player)), `recording` is the only account of the match the player receives, alongside the final scores. Under that mode what an Android writes down is part of its design, not a debugging aid.

```ts
const action: Action = {
  type: 'android.wait',
  memory: 'return-to-depot',
  recording: 'No safe route found this round.',
};
```

### Wait

Do nothing.

```ts
const action: Action = { type: 'android.wait' };
```

### Move

Move one tile north, south, east, or west, for `rules.android.moveBatteryCost` battery (`1`). Moving outside the map fails the turn, which costs the android its round and `rules.android.failedTurnHealthPenalty` health. The map's bounds are in `rules.world`, so an Android never has to guess where the edge is.

```ts
const action: Action = { type: 'android.move', direction: 'east' };
```

Directions: `north`, `south`, `east`, `west`.

### Charge

Recharge on an owned building on the android's current tile that can charge — any type whose `rules.buildings[type].charge` is above zero, which is the charger by default. Adds that much battery (`25`), capped at `rules.android.batteryCapacity` (`100`).

```ts
const action: Action = { type: 'android.charge' };
```

### Collect

Collect scattered material from the current tile into cargo. If `resources` is omitted, the android collects what it can up to cargo capacity.

```ts
const action: Action = { type: 'android.collect' };
const withResources: Action = { type: 'android.collect', resources: { metal: 3 } };
```

### Deposit

Deposit cargo into an owned storage-capable building on the current tile. If `resources` is omitted, deposits all cargo.

A building accepts deposits when `rules.buildings[type].storage.deposit` is true: depots, processors, and acid processing plants by default.

```ts
const action: Action = { type: 'android.deposit' };
const withResources: Action = { type: 'android.deposit', resources: { ore: 2 } };
```

### Withdraw

Withdraw material from an owned storage-capable building on the current tile.

```ts
const action: Action = { type: 'android.withdraw', resources: { metal: 4 } };
```

A building allows withdrawals when `rules.buildings[type].storage.withdraw` is true: depots, extractors, processors, and acid processing plants by default.

### Start Construction

Start a building on the current tile. The tile must not already contain a building. Supplied resources can come from android cargo. Current compatibility also allows using loose/current-tile material in some cases, but scripts should prefer collecting material into cargo first.

```ts
const action: Action = { type: 'android.start-construction', buildingType: 'charger', resources: { metal: 10 } };
```

### Continue Construction

Continue construction on an owned construction site on the current tile. If material requirements have been met, each continue action reduces remaining construction time by 1 tick.

```ts
const action: Action = { type: 'android.continue-construction' };
const withResources: Action = { type: 'android.continue-construction', resources: { electronics: 1 } };
```

### Salvage

Damage/salvage the building on the current tile. Initial chargers cannot be salvaged. Self-salvage is faster than hostile salvage. When a building is fully salvaged, part of its build cost becomes scattered material on the tile.

```ts
const action: Action = { type: 'android.salvage' };
```

### Broadcast

Broadcast a public message of up to `rules.android.broadcastLimit` characters (256). Messages are stored in world messages.

```ts
const action: Action = { type: 'android.broadcast', content: 'metal found at 3,4' };
```

### Clean Acid

Clean `rules.android.cleanAcidAmount` acid (`1`) from an adjacent tile. The android's owner must have a completed building that cleans acid anywhere in the world — `rules.buildings[type].cleansAcid`, the acid processing plant by default. The cleaned acid is stored as `acidCanister` in that building. Cleaning costs `rules.android.cleanAcidBatteryCost` battery (`1`).

```ts
const action: Action = { type: 'android.clean-acid', direction: 'north' };
```

### Launch

Launch another android of the same owner on the current tile, which must hold one of the owner's completed chargers. `scriptId` must be one of the owner's scripts, as listed in `world.scripts`. The launch is refused unless the owner has spare charger capacity, exactly as a player launch is (see [Chargers and Android Capacity](#6-chargers-and-android-capacity)). The new android starts at full battery and health and takes its first turn in the following round.

```ts
const action: Action = { type: 'android.launch', scriptId: 'script-2' };
```

### Dismantle

Destroy this android voluntarily.

```ts
const action: Action = { type: 'android.dismantle' };
```

With `targetAndroidId`, destroy another android of the same owner instead. The acting android must be on one of its owner's completed chargers, the target must be one of the owner's active androids, and an android cannot name itself as the target.

```ts
const action: Action = { type: 'android.dismantle', targetAndroidId: 'android-3' };
```

## 9. Resources and Progression

There are two resource sources.

### 9.1 Scattered Earth-Launched Material

Humanity launched material pods before the androids arrived. These materials are scattered across the map and can be directly collected by androids.

This is the early-game resource source. It enables first depots, chargers, and other basic infrastructure.

### 9.2 Natural Planetary Composition

Tiles may contain natural composition such as ore, water, acid, and radiation.

Composition usually cannot be picked up directly. It requires buildings:

- extractors harvest natural tile composition into building storage
- processors convert raw resources into construction-grade material
- acid processing plants enable cleanup of hazardous acid

## 10. Buildings

Current building types. Costs and construction times are `rules.buildings[type].cost` and `.ticks`:

| Building                | Cost                                 | Construction ticks | Function                                          |
| ----------------------- | ------------------------------------ | -----------------: | ------------------------------------------------- |
| `charger`               | 10 metal                             |                  2 | Increases android capacity by 1; charges androids |
| `depot`                 | 6 metal                              |                  2 | Stores material                                   |
| `extractor`             | 12 metal, 2 electronics              |                  5 | Harvests tile composition into storage            |
| `processor`             | 15 metal, 4 electronics, 2 polymer   |                  6 | Converts 2 ore into 1 metal at round end          |
| `acid-processing-plant` | 12 metal, 3 electronics, 2 polymer   |                  5 | Enables androids to clean adjacent acid           |
| `relay-tower`           | 8 metal, 4 electronics               |                  3 | Planned communication infrastructure              |
| `scanner`               | 8 metal, 6 electronics               |                  4 | Reveals nearby tiles at longer range              |
| `radar`                 | 14 metal, 10 electronics, 2 polymer  |                  7 | Reveals a radius-5 disc of tiles around itself    |
| `colony-module`         | 50 metal, 20 electronics, 20 polymer |                 12 | Planned victory/readiness infrastructure          |

A building under construction occupies its tile immediately. Buildings have `rules.buildings[type].health` health (`100`).

A completed building harvests `rules.buildings[type].extraction` from the composition of its own tile at round end, capped by what the ground holds. Only the extractor does by default:

- up to 2 `ore` from tile composition
- up to 1 `water` from tile composition
- up to 1 `acidCanister` from tile acid

Harvesting does not consume composition: the ground keeps yielding.

A completed building runs `rules.buildings[type].conversion` on its own storage once per round end. Only the processor does by default:

- 2 `ore` -> 1 `metal`

## 11. Acid and Environmental Preparation

Acid is both a hazard and a strategic resource.

- Androids standing on acid take damage at round end.
- Acid in tile composition is not loose material.
- Androids can clean acid from adjacent tiles only if their owner has a completed acid processing plant.
- Cleaning acid reduces the target tile's acid by 1 and stores 1 `acidCanister` in the plant.

This makes acid cleanup a mid-game environmental preparation goal rather than a free starting ability.

## 12. Salvage and Sabotage

Androids can salvage buildings on their current tile.

Rules:

- initial chargers cannot be salvaged
- self-salvage deals `rules.salvage.ownDamage` building damage per action (`25`)
- hostile salvage deals `rules.salvage.hostileDamage` building damage per action (`10`)
- buildings have `rules.buildings[type].health` health (`100`)
- when destroyed by salvage, returned material becomes scattered on the tile
- self-salvage returns `rules.salvage.ownReturnRate` of build cost (60%)
- hostile salvage returns `rules.salvage.hostileReturnRate` of build cost (35%)

Salvage is intentionally slower than ordinary collection and requires the android to remain at the target.

## 13. Communication

Androids can broadcast public messages.

Messages can be used for:

- local coordination
- map notes
- warnings
- claims
- deception
- negotiation
- debugging script behavior

There is no private radio by default. Relay towers are planned to expand communication behavior, but only basic message storage is currently implemented.

## 14. Visibility and Information

Visibility is recomputed from scratch at the end of every round: a tile is visible only while something of yours is in range of it, and goes dark again once nothing is. Sight comes from `rules.android.sight` and `rules.buildings[type].sight`; by default:

- active androids reveal tiles within range 2
- completed scanners reveal tiles within range 4
- completed radars reveal tiles within radius 5

A building type whose `sight` rule is `null` reveals nothing.

Sight range is measured two different ways, and the difference is deliberate:

- **Androids and scanners** count orthogonal steps (`|dx| + |dy|`), so their footprint is a diamond. It is the range the piece could actually walk, which makes short-range sight read as the piece looking around itself.
- **Radars** use true distance (`dx² + dy² <= radius²`), so their footprint is a disc. A radar sweeps rather than walks, and at radius 5 a diamond would read as an obvious lozenge on the board instead of a sweep.

A radar therefore sees roughly twice the ground a scanner does — about 81 tiles against 41 — for roughly twice the cost and almost twice the construction time. It is the mid-game answer to mapping a region, where the scanner is the early-game answer to seeing past your own Androids.

Each script receives a fogged world projection for its Android's owner. It includes the tiles that owner can currently see, as well as the acting Android's current tile so it can always inspect itself. Androids, buildings, and broadcasts are included only when their position is on an included tile. Other players' scripts and player records are omitted. The acting Android retains its `memory` and `recording`; those fields are `[Redacted]` on every other Android.

Deactivated Androids stay in `world.androids` as wrecks on the tile where they fell, so a script counting company should filter on `active`.

Sight is not memory: once your Androids move out of range, or a scanner or radar is salvaged, a tile drops out of the projection again. Scripts that need to remember the map must persist it themselves in Android `memory` or share it through broadcasts.

A player-facing replay preserves the complete world for rendering, but replaces another player's script source and Android `memory` and `recording` with `[Redacted]`. The same redaction applies to the corresponding event payloads.

## 15. Conflict

Project: Nova is primarily a construction, logistics, and programming strategy game. Conflict exists, but should not reduce the game to simple combat.

Current conflict tools are indirect:

- racing to scattered material
- occupying valuable building sites
- salvaging hostile infrastructure
- broadcasting misleading or persuasive information
- denying or cleaning hazardous terrain

Direct android combat is not implemented.

## 16. Colony Readiness Score

The readiness score answers: **which player has prepared the most viable colony right now?** It is calculated from the current `World` and reported per player with a contributor breakdown in `nova status` and the replay UI.

Only completed, functioning colony assets and materials secured in completed buildings count. Construction sites, loose material, Android cargo, scripts, messages, Android count, map discovery, scanners, radars, and relay towers earn no points. Sight infrastructure and exploration remain strategically useful because they help Androids locate viable resources and building sites.

Points come from `rules.scoring.buildings` and `rules.scoring.materials`; anything worth `0` points earns no line in the breakdown at all. The defaults:

| Contributor                   |     Points |
| ----------------------------- | ---------: |
| Colony module                 | 1,000 each |
| Acid-processing plant         |   120 each |
| Processor                     |   100 each |
| Extractor                     |    80 each |
| Depot                         |    40 each |
| Charger                       |    25 each |
| Stored metal                  | 2 per unit |
| Stored electronics or polymer | 3 per unit |
| Stored ore                    | 1 per unit |
| Stored water or acid canister | 2 per unit |

Stored materials count only when they are in a completed building owned by that player. The algorithm deliberately measures present readiness, not historical achievement: an asset that is salvaged or a stockpile that is spent stops contributing.

## 17. Design Goals

The rules should create these strategic questions:

- Where should I build my first real base?
- Should I expand chargers or secure resources first?
- Is it worth replacing an android with better code now?
- Should I broadcast openly, encode meaning, or stay silent?
- Is hostile salvage worth the time and risk?
- Should I clean acid, avoid it, or exploit it as a barrier?
- How much should I invest in exploration versus infrastructure?
- Can my androids recover from unexpected situations?

## 18. Rules

Everything numeric in this rulebook is a **rule**, and the rules are data. One
object holds all of them, every field has a default, and any subset can be
overridden — `{}` is the game as it ships.

```jsonc
// rules.json — a complete rules file
{
  "world": { "width": 24, "height": 24 },
  "android": { "cargoCapacity": 6 },
  "buildings": { "depot": { "cost": { "metal": 4 }, "ticks": 1 } },
}
```

```sh
npx nova create-game --file game.json --rules rules.json
```

The groups:

| Group       | Covers                                                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `world`     | Board size, and how a fresh map's composition and scattered material are generated                                            |
| `android`   | Cargo capacity, battery capacity and costs, decay, hazard damage, the failed-turn penalty, sight, and limits                  |
| `buildings` | Per type: cost, construction ticks, health, charging, android capacity, sight, storage, extraction, conversion, acid cleaning |
| `salvage`   | Salvage damage and the share of build cost returned                                                                           |
| `scoring`   | What each completed building and each stored material is worth                                                                |
| `match`     | The scheduled final round, if the match has one                                                                               |

Two conventions are worth knowing when writing a rules file:

- Every single value has a default, so a group can be given partially:
  `{ "android": { "cargoCapacity": 6 } }` leaves every other android rule alone.
- A leaf value object — a sight, a generation roll, a conversion — is supplied
  whole or not at all. `{ "sight": { "range": 6 } }` is rejected rather than
  silently inheriting a shape from somewhere else.

Mechanics read behaviour off the rules rather than off building names, so some
retunings that look like code changes are not: a depot with `androidCapacity: 1`
raises the android cap, and a building with a `conversion` refines material.

### Rules and Androids

The resolved rules are handed to every script as the `rules` global. An Android
should read them rather than repeat them:

```ts
const capacity = rules.android.cargoCapacity;
const depotCost = rules.buildings.depot.cost;
const onMap = (p: Position): boolean => p.x >= 0 && p.y >= 0 && p.x < rules.world.width && p.y < rules.world.height;
```

An Android that copies a number out of this rulebook is an Android that breaks
when the game is tuned — and the point of the `rules` global is that adapting is
cheaper than guessing.

### Rules and Recordings

A game file stores the rules it was created with, alongside the initial world and
the event log. Every later command — `run`, `status`, `play` — replays it under
those rules, so a retuned game continues and scores as itself. A recording made
before rules were data opens under the shipped defaults, which is what it was
played with.

A peer match is played under the host's rules, and the recording each player
keeps carries them. The board size is currently the only rule the match offer
negotiates.

## 19. Not Yet Implemented / Expected Future Work

These concepts are intended but not fully implemented:

- launch delay
- fleet-arrival endgame
- relay tower broadcast extension
- direct defensive structures
- richer natural resource chains
- player-facing reports beyond recordings and world state
