# Balancing Nova

Nova's rules are data, which makes retuning cheap and forgetting _why_ a number is
what it is very easy. This document is the reasoning: what was measured, what the
measurements said, which defaults came out of them, and which ideas were tried and
thrown away.

Every figure below was produced by simulation against the real engine — the same
mechanics `nova run` uses, on seeded maps so a run can be repeated. The harness is
[`packages/game/bench`](../packages/game/bench):

```sh
pnpm --filter @morten-olsen/nova-game bench                      # the shipped game
SEEDS=3 RULES=candidate.json pnpm --filter ... bench             # a candidate, to compare
```

**When a default moves, re-run the bench and update this file.**

## 1. How to read a balance claim

Three questions, in order of how much they matter:

1. **Is there one right answer?** If a single strategy beats every other one, the
   game is solved and writing an Android is data entry. The acceptance test is a
   round-robin between strategy archetypes: none should win nearly everything, and
   none should lose everything.
2. **Can an opponent do anything about it?** A strategy that cannot be disrupted
   makes other players scenery. Contact — whether two players ever reach the same
   ground — is the precondition for everything competitive.
3. **Does the timeline come out right?** Scavenging should give way to industry, and
   a colony module should be a gamble rather than either a formality or a fantasy.

Absolute scores are the least interesting output. Ratios, win rates, and the round a
milestone lands on are what a tuning pass moves.

## 2. The exchange rate

Everything is priced in Android-turns, because turns are what a player spends.
Measured on the shipped defaults:

| Quantity                            | Measured                              |
| ----------------------------------- | ------------------------------------- |
| Material collected per Android-turn | **0.59 units**                        |
| Share of turns spent moving         | **79%**                               |
| Loose pool, and how much is lifted  | 130 units, **76% gone by round 100**  |
| Health at round 100                 | ~19 of 100, with one Android replaced |
| Electronics from a fed refinery     | **0.37 per round** per processor      |

Turned into what a building really costs:

| Building      | Units | Rounds of one Android's income |
| ------------- | ----: | -----------------------------: |
| Depot         |     6 |                            ~10 |
| Charger       |     8 |                            ~14 |
| Extractor     |    12 |                            ~20 |
| Processor     |    16 |                            ~27 |
| Colony module |    90 |                      ~150 (\*) |

(\*) which is the point: nobody gathers a colony module. Its 20 electronics and 20
polymer come out of a refinery at ~0.37 a round, so a module is an industry running
for fifty-odd rounds, or half that with a second processor.

## 3. The defaults, and why

| Rule                               | Was          | Now               | Because                                          |
| ---------------------------------- | ------------ | ----------------- | ------------------------------------------------ |
| `world.width/height`               | 16x16        | **12x12**         | Fairness and contact (§4.5)                      |
| `scattered.metal`                  | 1–5          | **1–4**           | The loose pool has to run out (§4.6)             |
| `scattered.electronics`            | 0.2, 1       | **0.5, 1**        | Bootstrap an industry, never skip one (§4.10)    |
| `scattered.polymer`                | 0.25, 1–2    | **none**          | Polymer is made, not found (§4.10)               |
| `generation.ore`                   | 55%, 1–6     | **25%, 3–8**      | Rich ground should be a place (§4.7)             |
| `android.cargoCapacity`            | 10           | **12**            | A hold that could not carry a charger (§4.1)     |
| `android.sight`                    | 2            | **3**             | 79% of turns are walking                         |
| `android.decayPerRound`            | 0.1          | **1.5**           | An Android that could not die (§4.2)             |
| `android.acidDamagePerPoint`       | 0.5          | **1.5**           | Hazards were scenery (§4.3)                      |
| `android.radiationDamagePerPoint`  | 0.25         | **0.75**          | Same                                             |
| `charger.cost` / `androidCapacity` | 10 metal / 1 | **8 metal / 2**   | The fleet arrived too late (§4.1)                |
| `extractor`                        | 14 units, 5t | **12 units, 3t**  | Industry starts one cargo load away (§4.4)       |
| `processor`                        | 21 units, 6t | **18 units, 4t**  | A project, not a different game (§4.4, §4.10)    |
| `acid-processing-plant`            | 17 units, 5t | **14 units, 4t**  | Same, and no polymer in its price (§4.10)        |
| `extractor.extraction`             | 2/1/1        | **3/2/1**         | One extractor should feed one refinery           |
| `processor.conversion`             | ore→metal    | **+ electronics** | The module's parts must be makeable (§4.4)       |
| `acid-processing-plant.conversion` | —            | **+ polymer**     | Cleaning should pay for itself                   |
| `salvage.hostileDamage`            | 10           | **15**            | Defence simply won (§4.8)                        |
| `salvage.repairAmount` / `Cost`    | —            | **10 / 1 metal**  | A raid should be a contest, not a wall           |
| `depot.salvageableByOthers`        | (all true)   | **false**         | Banked material is safe material (§4.8)          |
| `scoring.depot.diminishing`        | 1            | **0.7**           | The cheapest building won (§4.9)                 |
| `scoring.charger.diminishing`      | 1            | **0.8**           | Capping one moved the sprawl (§4.9)              |
| `match.replaceLostAndroids`        | —            | **true**          | Mortality without recovery is elimination (§4.2) |

## 4. Findings

### 4.1 A hold that could not carry a charger, and a fleet that arrived too late

`cargoCapacity` was 10 and a charger cost 10 metal, so any electronics picked up on
the way home made the one building that grows a fleet unaffordable without a round
trip through a depot. Measured: purpose-built expansion bots completed **0.3 extra
chargers in 40 rounds**.

Cargo 12 and a charger at 8 fixed affordability — measured in isolation, chargers
built rose **1.3 → 2.8**, throughput +10%, and score variance across seeds fell from
13% to 6%. But the second Android still arrived around **round 39**, because one
charger allowed exactly one Android and the second cost eleven rounds of income.
Every later milestone queued behind it.

`charger.androidCapacity: 2` is the fix, and the largest single lever in the pass:
the starting charger now allows a sibling on **round 1** (measured, 3/3 games), so
"double the hands before anything else" is the opening decision rather than a
mid-game luxury.

The rule this exposes: **anything costing more than a cargo hold needs multi-trip
delivery**, which is a much harder script. Costs sit either side of that line
deliberately — a depot and a charger are one load; a processor is not.

### 4.2 An Android that could not die

`decayPerRound` was 0.1, so an Android lasted a thousand rounds. Nothing about
keeping one alive was a decision, so nothing about losing one was either.

Now 1.5: about sixty-five rounds of careful work, less once hazards and its own
mistakes are counted. Measured, an Android that used to end a 100-round game at 78
health now ends it at ~19, with one replacement along the way.

That needed a mechanic, not just a number. A match launches exactly one Android per
player and nobody is at the controls afterwards, so mortality alone turned the first
fatal mistake into elimination — a player with one charger whose Android died on
round nine watched the rest of the match. `match.replaceLostAndroids` sends a
replacement to any player with no active Androids and a completed charger, carrying
their newest script. The cost is the round, the cargo it was holding, and the walk
back out: measured as throughput dropping from 0.78 to 0.66 units per Android-turn,
which is the shape of a setback rather than a defeat.

**Attrition and recovery are one design, not two.** A rule that makes units mortal is
unfinished until something answers "and then what?".

### 4.3 Hazards were scenery

At `acidDamagePerPoint: 0.5` an Android could stand in the worst acid on the board
for 80 rounds, so reading `composition` before stepping bought nothing. Now 1.5 for
acid and 0.75 for radiation: measured end-of-game health fell from 78 to 50 **with no
change in score** for a bot that already routed around hazards. The cost lands only
on bots that do not.

### 4.4 The colony module could not be built

A 16x16 map scattered **12.8 electronics** against the module's 20; measured
probability that a map held enough anywhere: **3%**. Nothing produced electronics —
the only conversion was ore into metal — so the 1,000-point hero piece, the radar,
the acid plant and the processor were all capped by whatever Earth happened to drop.

Fixed by making refining real rather than by scattering more parts: the processor
runs a second recipe (1 metal + 1 water → 1 electronics) and the acid plant turns its
canisters into polymer. Both spend material a colony could have banked, so a module
is still paid for in hauling.

**The first version of that recipe cost 2 metal, and measurement caught why that was
wrong.** The ore line above it makes one metal a round, so the intermediate starved: a
processor produced an electronics every thirtieth round — 0.03 a round, against the
20 a module needs. At one metal the lines balance and a fed processor makes **0.37 a
round**. Recipes that feed each other must balance at the rate the earlier one
produces, or the chain is decoration.

Measurement caught a second thing: **a shared cargo hold makes a two-input recipe a
logistics puzzle.** A hauler that fills up on whichever material the extractor has
most of starves the recipe that pays — the difference between 0.37 electronics a
round and none. That puzzle is worth keeping.

The tier was also too slow. At 14 units and 5 ticks an extractor needed multi-trip
delivery, and a measured 150-round game never completed one. At 12 units (one hold)
and 3 ticks, with the processor at 16 and 4, the reference strategy now lands an
**extractor on round 37 and a processor on round 42**.

### 4.5 Identical scripts finished 18–43% apart

Two players running the same script from opposite corners of a 16x16 board scored
18–43% apart on average, up to 165% on the worst seed. Map luck outweighed script
quality, which is fatal for a programming game.

Board size was the strongest lever, because it decides what share of the map a player
touches at all:

| Board | Tiles per player | Identical scripts finish |
| ----- | ---------------: | -----------------------: |
| 16x16 |              128 |                18% apart |
| 12x12 |               72 |             **3% apart** |
| 10x10 |               50 |                 5% apart |
| 8x8   |               32 |                19% apart |

12x12 is the sweet spot: big enough that pod luck averages out, small enough that
both players cover most of it — and small enough that they meet. 8x8 is noisy again
because there are too few pods for any one to be unimportant.

### 4.6 The gathering phase never ended

A 16x16 map held ~248 units of loose material and one Android lifted 31% of it in 100
rounds. The handover from scavenging to industry was never forced by scarcity; a
player chose it, or never bothered.

The pool is now ~130 units on a 12x12 board and **76% of it is gone by round 100**, so
the ground runs out and new material has to come from a refinery. Two wrong turns on
the way there are worth recording:

- **Thinning the pods to shrink the pool** (chance 0.25 → 0.2) pushed the share of
  turns spent walking from 44% to 72%. A smaller pool spread over the same ground is a
  longer trip between piles. Density and volume are different knobs, and volume
  belongs to pile _size_.
- **Cutting pile size too far** (metal 1–3) left 69 metal a board, barely more than
  the 36 the bootstrap chain costs — half a board per player left nothing over for a
  mistake, and the reference strategy stopped reaching industry at all. 1–4 works.

Note the standing cost: hauling is now less turn-efficient than it was (79% of turns
are movement against 44%). That is the intended pressure rather than a regression — an
extractor does not walk — but it is the number to watch if the early game starts to
feel like a slog.

### 4.7 Nothing positional to contest

Ore was on 55% of tiles at one to six, so good extractor ground was everywhere and
therefore worth nothing to scout for or deny. It is now on 25% of tiles at three to
eight: a rich tile is a place on the map, which is what scanners are for and what two
players can want at once.

### 4.8 Defence simply won

Hostile salvage did 10 damage a turn and a repair restored 20, so one defender
out-repaired two raiders and infrastructure was effectively safe. Now 15 against 10:
one defender roughly cancels one attacker, two raiders beat one defender, and a
building takes ~7 turns to bring down.

Depots are the deliberate exception — `salvageableByOthers: false`. Material that
reached a depot is safe, because otherwise hostile salvage was the best-paid action in
the game: a measured raid erased **470 points of stored material in 10 turns**. A rival
can contest the ground, the chargers, the extractors and the refineries; not the
stockpile already banked. An owner can still take their own depot down, and the
contents spill onto the tile.

### 4.9 The cheapest building was the best points on the board

Points per unit of material invested, before:

| Building     | Points/unit |
| ------------ | ----------: |
| Depot        |    **6.67** |
| Extractor    |        5.71 |
| Processor    |        4.76 |
| Charger      |        2.50 |
| Stored metal |        2.00 |

A depot turned 6 metal into 40 points; storing that metal was worth 12. The optimal
colony was a field of depots nobody stored anything in — 32 of them was the whole
map's metal turned into 1,280 points.

Deflating every number was tried and rejected: it lowered scores without changing the
ranking. The structural fix is `scoring.buildings[type].diminishing` — the depot pays
40, then 70% of the one before.

**Capping one building just moves the sprawl.** An 80-round game played through the CLI
afterwards ended with the starter bot holding **five chargers, 125 of its 169 points**:
the cheapest remaining flat-rate building had become the target. Chargers now diminish
too, at a gentler 0.8 because capacity has real use; the same game scores 92 for six of
them, with banked material making up the difference.

### 4.10 A colony module a lucky map could buy

Even after §4.4 made refining possible, **55% of boards scattered a module's 20
electronics and 20 polymer outright** — so on half the maps the supply chain the module
was supposed to require could simply be skipped.

Only one of the two refined materials can be withheld from the ground. Both refineries
cost the other's output — the processor cost a polymer, the acid plant cost a polymer
and two electronics — so removing both means neither can ever be built. Polymer is the
one to withhold, for three reasons:

- Electronics are what the _first_ industry building needs (an extractor costs two), and
  a bootstrap has to be findable. Withholding electronics instead would force the
  extractor and processor to become pure-metal builds, which makes the opening of the
  industry chain too cheap and throws away the early tension of hunting for scarce parts.
- It puts the game's premise into the cost of its winning piece. Polymer comes only from
  an acid processing plant, so a colony module can only be built by a player who has
  cleaned up part of the planet — which is what the Androids are there for. Before this,
  acid cleanup was the most decorative pillar in the game.
- It makes acid positional. An extractor on a tile holding both ore and acid is a
  canister source, so "where the good ground is" now has two answers worth wanting, and
  two players can want the same one.

Measured after: **metal 89, electronics 18, polymer 0** a board, and the share of maps
that could buy a module outright is **0%**. Loose electronics at one per pod leave about
nine a side against the seven a bootstrap costs — room for a mistake, and nowhere near
twenty.

The processor and the acid plant no longer cost polymer, and took a little metal in
exchange (18 and 14 units). Both remain more than one cargo hold, which is intended: the
industry tier is where multi-trip delivery starts.

## 5. Where the field stands

The acceptance test — four archetypes, every pairing, 12x12:

| Archetype                                     | 60 rounds | 120 rounds |
| --------------------------------------------- | --------: | ---------: |
| `industrialist` — extractor, refinery, module |   **89%** |    **89%** |
| `expander` — depot, chargers, bank, sprawl    |       67% |        67% |
| `sprawler` — cheap buildings, nothing else    |       33% |        22% |
| `hoarder` — bank everything in one depot      |       11% |        22% |

Before this pass, on the same test, it was the exact inverse: `expander` won 100% and
the industry archetype won **0%** while never completing a single industrial building.
Sprawl has gone from being the answer to the worst line of play, and the strategy that
requires real logistics is now the strongest.

Progress, not a finished job:

- **Industry is the strongest line at 89%, and that is still too high.** Once loose metal
  is scarce the scavenging strategies cannot keep up. Its 33–43% score deviation says it
  is a high-variance gamble that pays on average — arguably right for a colony module —
  but one archetype taking nine matches in ten is not a solved game only because the
  archetype in front happens to be the interesting one.
- **The spread is narrower and no longer length-dependent** (89/67/33/11 at sixty rounds,
  89/67/22/22 at a hundred and twenty). What this pass changed is which strategy is worth
  writing, not how lopsided the result is.
- **What would flatten it further is interaction, not arithmetic** — see §7 and §8.1.

## 6. Timeline

Measured with the reference strategy — gather, expand, industrialise, attempt a module
— on the shipped defaults:

| Milestone                     | Round |
| ----------------------------- | ----- |
| Second Android                | **1** |
| First depot                   | 17    |
| Extractor                     | 37    |
| Processor                     | 42    |
| Loose metal exhausted         | ~40   |
| Module, from refined material | 90+   |

So: **20–40 rounds is a scavenging sprint; 60 is where industry starts to pay; 100–120
is where every archetype has a case and a colony module is a gamble a good script
might land.** These are an upper bound produced by a competent bot, not a floor — a
stronger script should compress them.

## 7. What no number will fix

The contest is still indirect: racing, denial, raiding. Nothing makes one player's
success reduce another's, so two good scripts mostly play parallel games and the
better one wins. Board size buys contact and raiding buys friction, but the real
answer is a shared pressure everyone must respond to differently — which is what the
planned environmental events are for, and the right place for it.

The bench has a limit worth remembering when reading §5: only the `industrialist`
archetype can do multi-trip delivery and refinery hauling, so the other three are in
effect four flavours of scavenging, and a finding about the industry tier rests on one
bot's competence. When the archetypes gain those skills, re-run the acceptance test
before trusting its ranking again.

## 8. Ideas for future mechanics

A shortlist rather than a wishlist: each of these exists to fix a problem that was
_measured_ in this pass, and each says what balance lever it would hand us. Ranked by
what they fix over what they cost.

### 8.1 Contested map objectives

**Fixes:** nothing currently makes one player's success reduce another's (§7). Two
good scripts play parallel games and the better one wins.

A handful of generated features — a landing-pad site, an aquifer, a crater of dense
pods — that score **only for whoever holds them when the score is taken**. Holding
means having a completed building on or adjacent to them. Suddenly a rival's gain is
your loss, scouting has a target, and a lead is something that can be taken away
rather than only out-built.

**Lever:** how many, how far apart, and how much they are worth relative to a
depot. **Risk:** turns the game into a land grab if they are worth too much; three or
four modest ones on a 12x12 board is the shape to try first.

### 8.2 A colonist manifest instead of a sum of assets

**Fixes:** readiness is pure accumulation, so the optimal play is "build whatever has
the best points per metal" — the flat-rate sprawl problem that §4.9 patched twice and
will keep recurring for every new building.

The arriving colonists need a specific bill of materials, announced at match start and
readable as a rule: so much water, so much housing, so much cleaned ground, this many
chargers. Score is how much of the manifest is _met_, and surplus is worth little.

That inverts the whole optimisation: hoarding the wrong thing loses, the manifest is
information worth acting on, and a new building type cannot break the economy just by
being cheap — it only matters if the manifest asks for it.

**Lever:** the manifest itself, per match. **Risk:** the biggest change here, and it
makes scripts read a target they must plan against rather than a number they can
maximise greedily. That is the point, and it is also the work.

### 8.3 Environmental events

**Fixes:** interaction without combat, and script rigidity. Already planned for v2.

A scheduled, deterministic shock every player must answer differently: an acid bloom
spreading from a seed tile, a radiation storm crossing the board, a dust season that
halves sight for ten rounds. Deterministic per seed so replays still agree, and
_forecast_ — a script can read that it is coming — so it rewards planning rather than
punishing luck.

This is also the natural home for pressure on the leader: the player with the most
exposed infrastructure has the most to lose from a bloom.

**Lever:** frequency, severity, and how much warning. **Risk:** an unforecast event is
indistinguishable from map luck, which is what §4.5 spent the whole pass reducing.

### 8.4 Let a player see their own colony

**Fixes:** multi-android strategies are close to unwritable, which suppresses a whole
strategic axis — and the fleet is the main multiplier the economy has.

The fog currently hides a player's _own_ buildings once nothing of theirs is in range,
`memory` is per-Android, and the only channel between siblings is a public broadcast.
Writing the reference bot for this pass, most of its complexity was re-deriving where
its own depot was; an earlier version flip-flopped between two build sites as the base
went in and out of view and paced itself to death.

Three ways, cheapest first: always include the player's own buildings in their
projection; give a player one shared scratchpad alongside per-Android `memory`; or make
this what the **relay tower** does — it is the one building that can be built today and
has no mechanic behind it.

**Lever:** whether coordination is free, bought with a building, or impossible. **Risk:**
almost none for the first option, and it removes busywork rather than difficulty.

### 8.5 Colony upkeep

**Fixes:** the structural version of §4.9. A colony is a pile that never needs
attention, so late-game turns have nothing to do and every cheap building is pure
profit forever.

Completed buildings lose a little health each round and need `android.repair` — which
already exists — or extraction yield falls on a tile that has been worked for a long
time. More buildings then cost more attention, which caps sprawl by making it a running
expense rather than by discounting it per type.

**Lever:** upkeep per building per round. **Risk:** busywork if the rate is high enough
to need a dedicated maintenance Android; it should be a background tax, not a job.

### 8.6 A price on launching

**Fixes:** the fleet snowball. Launching is free, so with capacity available the answer
is always "launch now" — a decision with one right answer.

Either a material cost per Android, or the planned launch delay (capacity is committed
for N rounds before the Android arrives). Now that Androids are mortal (§4.2), a price
also makes attrition genuinely expensive and makes keeping one alive worth doing.

**Lever:** cost or delay. **Risk:** interacts with `replaceLostAndroids` — a replacement
should probably be free, or a player who cannot afford one is eliminated by the back
door, which is exactly what that rule exists to prevent.

### 8.7 Something to do about the walking

**Fixes:** 79% of turns are movement (§4.6), and the figure went _up_ as the loose pool
was tightened.

Roads or a conveyor that let an Android move further along prepared ground; or a
transport that shuttles cargo between two owned depots without a turn each way. Either
makes base layout a decision and rewards a colony that plans its geometry.

**Lever:** how much movement it saves. **Risk:** the most complexity per unit of
balance of anything here, which is why it is last.

### 8.8 Named match formats

Not a mechanic, but the cheapest honest fix for something measured: **match length
decides which strategies exist** (§5). Sixty rounds is an industry sprint; a hundred and
twenty is a competitive field. Ship presets — sprint, standard, long — each with the
rules tuned for that length, instead of one set of defaults pretending every length is
the same game.

## 9. Defects the pass turned up

Balance work found nine mechanical defects, all fixed and covered in
`packages/game/test/construction.test.ts` and `mechanics.test.ts`. The four that
mattered:

- **Salvage returned a share of a building's type cost rather than of what was paid
  into it.** Placing a colony-module site with an empty hold and taking it apart
  yielded 30 metal, 12 electronics and 12 polymer out of nothing, in five turns.
- **A site's outstanding cost was measured as a total across all materials.**
  Supplying 20 units of worthless water to a 6-metal depot drove that total negative
  and the depot completed, paid for in nothing anyone wanted.
- **`resources` accepted negative amounts.** `deposit { metal: -1000 }` minted a
  thousand metal into cargo, ignoring cargo capacity.
- **Two definitions of "complete".** Scoring, extraction, conversion and sight asked
  only whether construction ticks had run out; everything else also asked whether the
  material had been paid. A ruleset with `ticks: 0` scored buildings nobody had paid
  for.

The lesson for future tuning: rules are data, and data reaches mechanics written when
the numbers were different. A retune is a good time to ask which mechanic misbehaves
if a value goes to zero.
