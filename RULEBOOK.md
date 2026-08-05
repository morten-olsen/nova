# Project: Nova Rulebook

Project: Nova is a programming strategy game about preparing a hostile planet for human colonization. Players do not directly command units during play. Instead, each player writes android programs, uploads them as scripts, launches androids, and studies the resulting simulation to improve later script versions.

This rulebook is written for players and coding agents that want to play the current game. Numeric values are defaults and may change as the rules are tuned.

## 1. Objective

Only one player can become the planet's founding colony authority.

The current ruleset does not yet implement final victory scoring. The intended endgame is colony readiness: players prepare a viable colony through infrastructure, explored territory, reliable logistics, environmental preparation, resource supply, and defensive resilience.

For now, a good android strategy should focus on:

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
- `world` — the current world snapshot visible to the script runner

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
- optional `revealedBy`: player ids that have revealed the tile

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

An android script must return one android event. The engine adds `androidId` automatically.

### Wait

Do nothing.

```js
({ type: 'android.wait' })
```

### Move

Move one tile north, south, east, or west. Moving outside the map fails the turn and deactivates the android.

```js
({ type: 'android.move', direction: 'east' })
```

Directions: `north`, `south`, `east`, `west`.

### Charge

Recharge on an owned charger on the android's current tile. Adds up to 25 battery, capped at 100.

```js
({ type: 'android.charge' })
```

### Collect

Collect scattered material from the current tile into cargo. If `resources` is omitted, the android collects what it can up to cargo capacity.

```js
({ type: 'android.collect' })
({ type: 'android.collect', resources: { metal: 3 } })
```

### Deposit

Deposit cargo into an owned storage-capable building on the current tile. If `resources` is omitted, deposits all cargo.

Storage-capable buildings currently include depots, processors, and acid processing plants.

```js
({ type: 'android.deposit' })
({ type: 'android.deposit', resources: { ore: 2 } })
```

### Withdraw

Withdraw material from an owned storage-capable building on the current tile.

```js
({ type: 'android.withdraw', resources: { metal: 4 } })
```

Storage-capable buildings currently include depots, extractors, processors, and acid processing plants.

### Start Construction

Start a building on the current tile. The tile must not already contain a building. Supplied resources can come from android cargo. Current compatibility also allows using loose/current-tile material in some cases, but scripts should prefer collecting material into cargo first.

```js
({ type: 'android.start-construction', buildingType: 'charger', resources: { metal: 10 } })
```

### Continue Construction

Continue construction on an owned construction site on the current tile. If material requirements have been met, each continue action reduces remaining construction time by 1 tick.

```js
({ type: 'android.continue-construction' })
({ type: 'android.continue-construction', resources: { electronics: 1 } })
```

### Salvage

Damage/salvage the building on the current tile. Initial chargers cannot be salvaged. Self-salvage is faster than hostile salvage. When a building is fully salvaged, part of its build cost becomes scattered material on the tile.

```js
({ type: 'android.salvage' })
```

### Broadcast

Broadcast a public message of up to 256 characters. Messages are stored in world messages.

```js
({ type: 'android.broadcast', content: 'metal found at 3,4' })
```

### Clean Acid

Clean 1 acid from an adjacent tile. The android's owner must have a completed acid processing plant anywhere in the world. The cleaned acid is stored as `acidCanister` in that plant. Cleaning costs 1 battery.

```js
({ type: 'android.clean-acid', direction: 'north' })
```

### Dismantle

Destroy this android voluntarily.

```js
({ type: 'android.dismantle' })
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

| Building | Cost | Construction ticks | Function |
| --- | --- | ---: | --- |
| `charger` | 10 metal | 2 | Increases android capacity by 1; charges androids |
| `depot` | 6 metal | 2 | Stores material |
| `extractor` | 12 metal, 2 electronics | 5 | Harvests tile composition into storage |
| `processor` | 15 metal, 4 electronics, 2 polymer | 6 | Converts 2 ore into 1 metal at round end |
| `acid-processing-plant` | 12 metal, 3 electronics, 2 polymer | 5 | Enables androids to clean adjacent acid |
| `relay-tower` | 8 metal, 4 electronics | 3 | Planned communication infrastructure |
| `scanner` | 8 metal, 6 electronics | 4 | Reveals nearby tiles at longer range |
| `colony-module` | 50 metal, 20 electronics, 20 polymer | 12 | Planned victory/readiness infrastructure |

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

Androids reveal nearby tiles at round end. Current reveal defaults:

- active androids reveal tiles within range 2
- completed scanners reveal tiles within range 4

Scripts currently receive the world snapshot from the engine. Future competitive modes may restrict this to visible/remembered information.

## 15. Conflict

Project: Nova is primarily a construction, logistics, and programming strategy game. Conflict exists, but should not reduce the game to simple combat.

Current conflict tools are indirect:

- racing to scattered material
- occupying valuable building sites
- salvaging hostile infrastructure
- broadcasting misleading or persuasive information
- denying or cleaning hazardous terrain

Direct android combat is not implemented.

## 16. Colony Claim and Endgame

Colony victory scoring is not implemented yet.

The intended endgame asks: which player best prepared the planet for humans?

Likely scoring factors:

- completed colony modules
- infrastructure quality
- explored territory
- reliable resource supply
- environmental cleanup
- power/logistics capacity
- ability to maintain a valid colony site until fleet arrival

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
- formal colony readiness scoring
- fleet-arrival endgame
- relay tower broadcast extension
- restricted fog-of-war for scripts
- direct defensive structures
- richer natural resource chains
- player-facing reports beyond recordings and world state
