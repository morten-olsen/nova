# Adding a new building

This is the end-to-end checklist for introducing a building type, from the game rules through the 3D piece to the player-facing documentation. The radar — added in this shape — is used as the worked example throughout.

Work in the order below. The rules come first because the engine is the contract; the model and the docs describe whatever the engine actually does.

## What the compiler will and will not catch

Two of these steps are enforced by types, and the rest are not. Knowing which is which is most of the value of this document.

The two rules tables — `rules.buildings` and `rules.scoring.buildings` — are exhaustive `Record<BuildingType, …>`s, so adding a type to the schema **breaks the build** until both are filled in. That is most of the wiring: cost, ticks, health, storage, sight, extraction, conversion, charging, capacity and score are all rules, and the mechanics read them generically. What the compiler will _not_ catch is a genuinely new effect (a mechanic to implement), the 3D piece, and the asset URL. Walk the whole list.

## 1. Declare the type

`packages/game/src/schemas/schemas.building.ts` owns the enum. Add the kebab-case id to `buildingTypeSchema`:

```ts
const buildingTypeSchema = z.enum([
  // …
  'scanner',
  'radar',
  'colony-module',
]);
```

`BuildingType` is inferred from this enum, so this one edit is what makes the next step a compile error rather than a silent omission.

## 2. Give it rules

`packages/game/src/rules/rules.buildings.ts` holds the table of building rules, and `tsc` will not pass until the new type has an entry. Cost and construction time are the only required fields; everything else defaults to inert:

```ts
radar: buildingRulesSchema({
  cost: { metal: 14, electronics: 10, polymer: 2 },
  ticks: 7,
  sight: { range: 5, shape: 'circular' },
}),
```

`packages/game/src/rules/rules.scoring.ts` is the second exhaustive table: give the type a label and its points, or `points: 0` if it deliberately earns no readiness (see step 4).

Everything a mechanic reads about a building type is in this entry, so most buildings need no code at all beyond it:

| Field             | Effect                                                                               |
| ----------------- | ------------------------------------------------------------------------------------ |
| `cost`, `ticks`   | What starting and finishing it takes                                                 |
| `health`          | How much salvage it absorbs                                                          |
| `charge`          | Battery an `android.charge` restores here; `0` means it is not a charger             |
| `androidCapacity` | Active Androids it allows its owner, and whether it is a deployment bay              |
| `sight`           | What it reveals each round while completed                                           |
| `storage`         | Whether it holds material, and whether Androids may deposit into or withdraw from it |
| `extraction`      | What it harvests from its own tile's composition each round end                      |
| `conversion`      | What it refines inside its own storage each round end                                |
| `cleansAcid`      | Whether it lets its owner's Androids clean adjacent acid                             |

Price the building against its nearest sibling rather than in the abstract. The radar covers roughly twice the ground a scanner does (about 81 tiles against 41), so it costs roughly twice as much and takes almost twice as long to build. A building that is strictly better than an existing one for a similar price makes the existing one dead content.

At this point the building is constructible, and does whatever its rules describe.

## 3. Give it a behaviour

Buildings have no inherent effects; a mechanic has to look for them. There are two routes.

**Reuse an existing effect** when the new building is a variation on one that already exists — which now means filling in a field in step 2 and writing no code. `game.reveal-tiles.ts` grants sight to any completed building whose `sight` rule is not `null`, `game.extract-resources.ts` harvests for any with an `extraction`, and `android.charge.ts` charges at any with a `charge` above zero.

Prefer making an effect rule-driven over adding a second `if`. A mechanic that tests `building.type === 'scanner'` is a mechanic that has to be edited for every future sibling; one that reads `rules.buildings[building.type].sight` never does, and the balance sheet gains a knob.

**Write a new mechanic** when the effect is genuinely new. Add `packages/game/src/mechanics/<area>/<area>.<verb>.ts` following `game.process-resources.ts` as a model, then register it in `packages/game/src/mechanics/game/game.ts` — a mechanic that is not in `createGameMechanics` never runs. Order matters: mechanics are applied in array order against the same event.

Whichever route you take, gate the effect on completion:

```ts
if (building.remainingConstruction.ticks === 0) {
  /* … */
}
```

A building under construction occupies its tile immediately, so an ungated effect makes construction sites work as finished buildings.

## 4. Wire up the optional hooks

None of these are required, and none of them will fail to compile if you skip them. Decide about each one explicitly.

- **Score** — `rules.scoring.buildings` in `packages/game/src/rules/rules.scoring.ts`. `points: 0` keeps the type out of the breakdown entirely, which is the right answer for infrastructure that enables play rather than constituting colony readiness: scanners, radars, and relay towers all deliberately score nothing. Give it a label regardless, so a ruleset that wants to score it has something to name it by.
- **Storage** — the `storage` rule both decides whether the building is created with a storage bundle and whether Androids may deposit into or withdraw from it. `{ deposit: false, withdraw: true }` is the extractor: it fills itself and hands material out.
- **Round-end processing** — `extraction` and `conversion` cover harvesting from the ground and refining in storage. A round-end effect that is neither needs a new mechanic (step 3).

## 5. Design and build the piece

Read [visual-design.md](visual-design.md) first, particularly _Piece language_ and _Gameplay silhouettes_. The binding constraints are that the piece must be identifiable by outline alone at replay distance, must stay inside its plinth (radius `0.41`), and must stay below `0.9` tile units tall unless it is deliberately narrow.

The hard part is silhouette distinctness within a role. The relay tower is a narrow mast and the scanner is a round dish, so the radar had to be neither: it became a flat rectangular array slab on a squat rotator turret. When a new piece joins an existing family, take the primitive none of its siblings uses.

Add a builder to `packages/renderer/blender/scripts/generate-nova-pieces.py`, assembled from the shared helpers in `nova_kit.py` so the piece reads as part of the family, and register it in `PIECE_BUILDERS`:

```python
def build_radar(materials: Materials) -> None:
    add_plinth(materials)
    add_collar(materials, (0, 0, 0.16), 0.26)
    # …

PIECE_BUILDERS = {
    # …
    "radar": build_radar,
}
```

Use `FactionAccent` for the ownership read — the renderer tints it per player, so never export one model per faction. Keep the geometry deterministic; the generator is the source of truth and is committed alongside its output.

Export the piece:

```sh
blender --background --python packages/renderer/blender/scripts/generate-nova-pieces.py -- --only radar
```

That writes three files: `assets/models/radar.glb`, `assets/previews/radar.png`, and `blender/source/radar.blend`. Commit all three.

Then judge the piece against the set, not on its own:

```sh
blender --background --python packages/renderer/blender/scripts/generate-nova-pieces.py -- --contact-sheet
```

The contact sheet renders every piece in one orthographic row, which is the view that exposes a silhouette collision. It is a review artifact — look at it, then leave it uncommitted.

## 6. Register the model with the renderer

`packages/renderer/src/tabletop-assets.ts` maps building type to GLB:

```ts
const assetUrls: Record<string, string> = {
  // …
  radar: new URL('../assets/models/radar.glb', import.meta.url).href,
};
```

This is the only renderer change a normal building needs. `PieceKind` derives from `Building['type']`, and layout, picking, fog, ownership tinting, and construction treatment are all generic. A type missing from `assetUrls` does not crash — `getBuildingKind` falls back to the purple `unknown-structure` placeholder, which is exactly what an unregistered building looks like on the board.

Only touch `tabletop-actors.ts` if the piece needs bespoke animation.

## 7. Test the behaviour

Add a case to `packages/game/test/game-engine.test.ts` driving the real `Loop` and `createBaseRuleset` rather than calling the mechanic directly. Assert the effect, its boundary, and that an unfinished building has no effect. The radar test asserts a tile just inside the radius, one just outside, a tile that distinguishes a disc from a diamond, and that a radar still under construction reveals nothing.

## 8. Update the documentation

- [RULEBOOK.md](RULEBOOK.md) — add a row to the building table in _§10 Buildings_ with cost, ticks, and function, and describe the mechanic in the section that owns it (the radar's sight rules went in _§14 Visibility and Information_). If the building scores, update _§16_; if it deliberately does not, add it to the list of things that earn no points. State numbers as the defaults they are, naming the rule they come from.
- [visual-design.md](visual-design.md) — add a row to the _Gameplay silhouettes_ table.
- `packages/renderer/assets/previews/README.md` — add the preview to the table.
- [../README.md](../README.md) — extend the list of what Androids can build.
- [CLI-GUIDE.md](CLI-GUIDE.md) — only if the building changes what `status` reports about readiness.

`docs/ANDROID-BUILDER-MANUAL.md` deliberately does not enumerate building types; it points at the rulebook. Leave it alone unless the new building changes the script contract.

## 9. Verify

```sh
pnpm run check        # tsc -b across the workspace
pnpm test
pnpm run format
pnpm run lint:eslint
```

Then look at the piece on a real board — `pnpm nova play --file game.json` on a recording that contains one — because a model that reviews well in isolation can still be unreadable at replay distance among its neighbours.

Note that `docs/package.json` controls which documents ship to a player's factory. This guide is for contributors and deliberately stays out of that list.
