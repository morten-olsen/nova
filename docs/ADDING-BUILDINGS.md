# Adding a new building

This is the end-to-end checklist for introducing a building type, from the game rules through the 3D piece to the player-facing documentation. The radar — added in this shape — is used as the worked example throughout.

Work in the order below. The rules come first because the engine is the contract; the model and the docs describe whatever the engine actually does.

## What the compiler will and will not catch

Two of these steps are enforced by types, and the rest are not. Knowing which is which is most of the value of this document.

`buildingCosts` and `buildingTicks` are `Record<BuildingType, …>`, so adding a type to the schema **breaks the build** until both are filled in. Everything else — the behaviour mechanic, the model, the asset URL, the score entry, the storage lists — is either optional or keyed by a `Partial` map, so a half-added building type compiles cleanly and simply does nothing. Walk the whole list.

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

## 2. Set cost and construction time

`packages/game/src/mechanics/construction/construction.defaults.ts` holds both maps. `tsc` will not pass until the new key exists in each:

```ts
const buildingCosts: Record<BuildingType, MaterialBundle> = {
  // …
  radar: { metal: 14, electronics: 10, polymer: 2 },
};

const buildingTicks: Record<BuildingType, number> = {
  // …
  radar: 7,
};
```

Price the building against its nearest sibling rather than in the abstract. The radar covers roughly twice the ground a scanner does (about 81 tiles against 41), so it costs roughly twice as much and takes almost twice as long to build. A building that is strictly better than an existing one for a similar price makes the existing one dead content.

At this point the building is constructible and does nothing.

## 3. Give it a behaviour

Buildings have no inherent effects; a mechanic has to look for them. There are two routes.

**Extend an existing mechanic** when the new building is a variation on an effect that already exists. The radar took this route: `packages/game/src/mechanics/game/game.reveal-tiles.ts` already granted sight to scanners, so the radar joined its sight table.

```ts
const buildingSight: Partial<Record<BuildingType, Sight>> = {
  scanner: { range: 4, shape: 'stepped' },
  radar: { range: 5, shape: 'circular' },
};
```

Prefer promoting a hardcoded check into a table like this over adding a second `if`. The pre-radar code tested `building.type === 'scanner'` inline; turning that into a map made the third sight source a one-line data change instead of another branch.

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

- **Score** — `packages/game/src/scoring/scoring.ts`. `buildingScores` is `Partial`, so an absent type scores zero. That is the right answer for infrastructure that enables play rather than constituting colony readiness: scanners, radars, and relay towers all deliberately score nothing. If the building _is_ colony readiness, add a label and points.
- **Storage** — a building only gets a `storage` bundle if its type is in the list in `construction.start-construction.ts`. If Androids should also put material in or take it out, the matching lists in `android.deposit.ts` and `android.withdraw.ts` are separate and must be updated too. These three lists are independent by design — a processor accepts deposits and allows withdrawals, an extractor only allows withdrawals.
- **Round-end processing** — see `game.extract-resources.ts` and `game.process-resources.ts` for the pattern of transforming stored material each round.

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

- [RULEBOOK.md](RULEBOOK.md) — add a row to the building table in _§10 Buildings_ with cost, ticks, and function, and describe the mechanic in the section that owns it (the radar's sight rules went in _§14 Visibility and Information_). If the building scores, update _§16_; if it deliberately does not, add it to the list of things that earn no points.
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
