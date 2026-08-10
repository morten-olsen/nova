# Project: Nova Rulebook

Project: Nova is a programming strategy game about preparing a hostile planet for human colonization. Players do not directly command units during play. Instead, each player writes android programs, uploads them as scripts, launches androids, and studies the resulting simulation to improve later script versions.

This rulebook is written for players and coding agents that want to play the current game. Numeric values are defaults and may change as the rules are tuned.

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

Androids are autonomous once launched. A script returns one android action per turn.

Scripts run with these globals:

- `androidId` — the id of the android currently taking its turn
- `world` — the fogged world snapshot visible to the script runner

A simple script returns an event object:

```js
({ type: 'android.move', direction: 'east' });
```

## 3. World

The planet is a rectangular grid of tiles.

Each tile has:

- `position`: `{ x, y }`
- `composition`: materials and hazards in the ground
- `scattered`: loose earth-launched material on the surface
- optional `revealedBy`: player ids that can **currently** see the tile

Tile composition is generated randomly when a new map is created. Composition is not the same as loose material. Composition represents things in the ground or environmental conditions.

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
- `memory` — private persistent working state, limited to 4,096 characters
- `recording` — player-facing persistent log, limited to 16,384 characters

Androids can currently:

- move one tile orthogonally
- collect scattered material from their current tile
- carry up to 10 total material units
- start and continue construction
- charge on owned chargers
- deposit to and withdraw from storage-capable owned buildings
- salvage buildings
- broadcast public messages
- clean acid from adjacent tiles if their owner has an acid processing plant
- dismantle themselves

Androids have health. They lose a small amount of health over time. Environmental hazards can damage them faster.

At round end:

- every android loses `0.1` health from ordinary decay
- radiation damages androids by `radiation * 0.25`
- acid damages androids by `acid * 0.5`

Androids with health at or below 0, or battery at or below 0, are destroyed and removed from active play.

## 6. Chargers and Android Capacity

Chargers determine android deployment capacity.

A player's active android cap equals the number of completed chargers they own.

Examples:

- 1 charger allows 1 active android
- 3 chargers allow 3 active androids

A player always has at least their initial charger. Initial chargers are placed on non-overlapping tiles when the world is set up.

If a non-initial charger is destroyed or salvaged, the player's deployment cap immediately decreases. Existing androids are not automatically destroyed, but the player cannot launch more androids until their active android count is below the current cap.

Launching is currently immediate if capacity is available. Launch delay is planned but not implemented yet.

## 7. Scripts, Launching, and Dismantling

Players may upload improved script versions during the game. Existing androids do not automatically update to a new script.

To use a new script version, a player must launch a new android with that script id, or dismantle/free capacity and launch a replacement.

Dismantling is voluntary. It destroys the android and frees charger capacity. It currently returns no material.

## 8. Android Action API

An android script must return one android event. The engine adds `androidId` automatically. Every action may also include optional `memory` and `recording` string fields. They replace the Android's previous values as part of the same turn; they are not separate actions. Scripts can read both values from their Android in `world.androids`. `memory` is for operational state across turns. `recording` is the log available to the player after the Android is deactivated.

```js
({
  type: 'android.wait',
  memory: 'return-to-depot',
  recording: 'No safe route found this round.',
});
```

### Wait

Do nothing.

```js
({ type: 'android.wait' });
```

### Move

Move one tile north, south, east, or west. Moving outside the map fails the turn and deactivates the android.

```js
({ type: 'android.move', direction: 'east' });
```

Directions: `north`, `south`, `east`, `west`.

### Charge

Recharge on an owned charger on the android's current tile. Adds up to 25 battery, capped at 100.

```js
({ type: 'android.charge' });
```

### Collect

Collect scattered material from the current tile into cargo. If `resources` is omitted, the android collects what it can up to cargo capacity.

```js
({ type: 'android.collect' })({ type: 'android.collect', resources: { metal: 3 } });
```

### Deposit

Deposit cargo into an owned storage-capable building on the current tile. If `resources` is omitted, deposits all cargo.

Storage-capable buildings currently include depots, processors, and acid processing plants.

```js
({ type: 'android.deposit' })({ type: 'android.deposit', resources: { ore: 2 } });
```

### Withdraw

Withdraw material from an owned storage-capable building on the current tile.

```js
({ type: 'android.withdraw', resources: { metal: 4 } });
```

Storage-capable buildings currently include depots, extractors, processors, and acid processing plants.

### Start Construction

Start a building on the current tile. The tile must not already contain a building. Supplied resources can come from android cargo. Current compatibility also allows using loose/current-tile material in some cases, but scripts should prefer collecting material into cargo first.

```js
({ type: 'android.start-construction', buildingType: 'charger', resources: { metal: 10 } });
```

### Continue Construction

Continue construction on an owned construction site on the current tile. If material requirements have been met, each continue action reduces remaining construction time by 1 tick.

```js
({ type: 'android.continue-construction' })({ type: 'android.continue-construction', resources: { electronics: 1 } });
```

### Salvage

Damage/salvage the building on the current tile. Initial chargers cannot be salvaged. Self-salvage is faster than hostile salvage. When a building is fully salvaged, part of its build cost becomes scattered material on the tile.

```js
({ type: 'android.salvage' });
```

### Broadcast

Broadcast a public message of up to 256 characters. Messages are stored in world messages.

```js
({ type: 'android.broadcast', content: 'metal found at 3,4' });
```

### Clean Acid

Clean 1 acid from an adjacent tile. The android's owner must have a completed acid processing plant anywhere in the world. The cleaned acid is stored as `acidCanister` in that plant. Cleaning costs 1 battery.

```js
({ type: 'android.clean-acid', direction: 'north' });
```

### Dismantle

Destroy this android voluntarily.

```js
({ type: 'android.dismantle' });
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

Current building types:

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

A building under construction occupies its tile immediately.

Completed extractors harvest at round end:

- up to 2 `ore` from tile composition
- up to 1 `water` from tile composition
- up to 1 `acidCanister` from tile acid

Completed processors convert stored resources at round end:

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
- self-salvage deals 25 building damage per action
- hostile salvage deals 10 building damage per action
- buildings have 100 health by default
- when destroyed by salvage, returned material becomes scattered on the tile
- self-salvage returns about 60% of build cost
- hostile salvage returns about 35% of build cost

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

Visibility is recomputed from scratch at the end of every round: a tile is visible only while something of yours is in range of it, and goes dark again once nothing is. Current sight defaults:

- active androids reveal tiles within range 2
- completed scanners reveal tiles within range 4
- completed radars reveal tiles within radius 5

Sight range is measured two different ways, and the difference is deliberate:

- **Androids and scanners** count orthogonal steps (`|dx| + |dy|`), so their footprint is a diamond. It is the range the piece could actually walk, which makes short-range sight read as the piece looking around itself.
- **Radars** use true distance (`dx² + dy² <= radius²`), so their footprint is a disc. A radar sweeps rather than walks, and at radius 5 a diamond would read as an obvious lozenge on the board instead of a sweep.

A radar therefore sees roughly twice the ground a scanner does — about 81 tiles against 41 — for roughly twice the cost and almost twice the construction time. It is the mid-game answer to mapping a region, where the scanner is the early-game answer to seeing past your own Androids.

Each script receives a fogged world projection for its Android's owner. It includes the tiles that owner can currently see, as well as the acting Android's current tile so it can always inspect itself. Androids, buildings, and broadcasts are included only when their position is on an included tile. Other players' scripts and player records are omitted.

Sight is not memory: once your Androids move out of range, or a scanner or radar is salvaged, a tile drops out of the projection again. Scripts that need to remember the map must persist it themselves in Android `memory` or share it through broadcasts.

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

## 18. Not Yet Implemented / Expected Future Work

These concepts are intended but not fully implemented:

- launch delay
- fleet-arrival endgame
- relay tower broadcast extension
- direct defensive structures
- richer natural resource chains
- player-facing reports beyond recordings and world state
