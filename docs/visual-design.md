# Project Nova visual design

## Design intent

Project Nova is a **premium physical tabletop game brought to life digitally**: display-quality sci-fi miniatures, each standing on its own base plate, arranged on a hostile alien board. The visual direction is **frontier NASA-punk**—ceramic pressure hulls, powder-coated graphite machinery, exposed energy hardware, and optimistic colony technology—not generic military hardware or photorealistic machinery.

The reference point is a **collector's-edition board game**, and that comparison decides arguments. A piece is a painted miniature on a base: crisply highlighted, panel-lined, weathered with restraint, and dirtiest on its base rather than all over its hull. It is not a robot standing in dirt, and it is not a flat-shaded colour block either.

The presentation must make one-tile actions, ownership, hazards, and infrastructure roles legible at a glance. The visual hierarchy is always:

1. **Board state** — tile boundaries, terrain, and hazards
2. **Gameplay pieces** — androids and buildings, distinguished by silhouette
3. **Ownership and status** — colour accents, light, and concise overlays
4. **Atmosphere** — restrained effects that never obscure state

## Source of truth

| What | Lives in |
| --- | --- |
| Runtime colour language | `packages/renderer/src/nova-palette.ts` |
| Surface classes and the bake | `packages/renderer/blender/scripts/nova_surfaces.py` |
| Geometry primitives and motifs | `packages/renderer/blender/scripts/nova_kit.py` |
| Bake, render, and export machinery | `packages/renderer/blender/scripts/nova_build.py` |
| Tailwind theme tokens | `apps/web/src/app.css` |

Change the palette first, then let the others follow. A piece on the board and its row in the scoreboard must never disagree about who owns what.

## World and camera

- Use an orthographic or near-orthographic, three-quarter tabletop camera.
- The board grid is the unit of measure: a standard piece fits inside **1 × 1 tile**, and the renderer scales it to 78% of a tile when it stands alone.
- Blender models use metres as game units, Z-up, and face local **−Y**. Their origin sits at the centre of the base plate, on the ground plane, so `min y == 0` after export.
- Keep standard buildings below 0.9 tile units tall; tall elements may reach 1.2 only when they are deliberately narrow (relay tower, scanner).
- Camera rotation stays disabled. Pieces have a designed front, and free orbit makes their fixed facing read as wrong.

## The board as an object

The board is a **recessed graphite tray**, not a plane floating in space:

- a solid body beneath the play area, with a single bevelled rim extrusion around it
- the ground inset below the rim's top edge, so the frame reads as a lip containing it
- a soft contact shadow underneath, so the board sits on something

Terrain, hazards, and fog all share the same displaced ground geometry, offset along it. Anything drawn flat gets clipped by the relief.

## Terrain language

Terrain is **spatially coherent**: features cross tile boundaries. Per-tile independent noise reads as a cork checkerboard and is never acceptable.

- a low-frequency fBm colour field over the regolith ramp, with ridged mineral veining breaking up the ochre
- faint, tight dust drifts — wide or strong smears read as smoke sitting above the board
- sparse rock scatter as the only high-frequency detail, giving a sense of scale
- the tile grid **engraved**: a dark score with a lit lower edge, so the surface reads as a manufactured board laid over terrain

The static ground is painted once, when the board's shape changes. Only hazards and fog animate.

## Fog of war

Visibility is **current line of sight, not permanent discovery**. A tile is visible only while something of yours is in range; it goes dark again when nothing is.

- unexplored ground is cold, flat, and near-black — genuinely unknown, not merely dimmed
- reveal and re-fog **animate** per tile; a hard cut reads as a glitch next to everything else easing
- a faint cyan rim marks tiles bordering the unknown, so the edge of your knowledge reads as an active frontier
- whether a recording uses fog at all is decided from the **whole recording**. A single frame cannot tell "nothing explored yet" from "this recording predates fog", and getting that backwards turns fog off exactly when the board should be fully dark.

## Selection language

- **Hover**: a subtle bracket reticle plus a pointer cursor. Cursor feedback is the cheapest possible signal that tiles are clickable.
- **Selected**: a brighter, slowly breathing reticle. Four corner brackets rather than a closed outline — an open reticle reads as a command interface and never obscures the piece.
- Reticles are unlit, so they read as UI layered on the board rather than another physical object. Pieces standing on the tile still occlude them.
- Clicking a **model** selects that android or building; clicking bare ground selects the tile. A selected piece is raised slightly.

## The base plate

Every built piece stands on a base plate. It is the thing that makes a model read as a *game piece* rather than as scenery, and it is built by `add_base_plate` in `nova_kit.py` so no two pieces invent their own:

- a **chamfered graphite rim** from `z = 0` to `0.060`, and a slate lip to `0.078`
- a **recessed ground inset** whose top sits at `z = 0.070`, below the lip, so the rim reads as a frame containing ground
- **real scattered grit geometry** on that ground. The basing surface deliberately carries no panel seams, so this is its only relief — and a textured base is much of what separates a display miniature from a toy.
- a **faction inlay** along the front edge, so ownership stays readable from directly overhead where hull accents are hidden
- a **designation plate**, because a manufactured piece carries a part number

The rim is the **widest thing at ground level and nothing may overhang it**. This is a hard constraint, not a style note: the renderer packs several pieces onto a shared tile, and an overhanging arm or dish collides with its neighbours. Tools held out at the shoulder line will breach the rim — converge them toward the centreline instead.

Radii: `BASE_RADIUS` (0.41) for buildings, 0.345 for the android, 0.32 for the relay tower so its mast reads slender rather than planted on a dinner plate. The loose material cache has **no base plate** — it was dropped from orbit, not built.

## Surface language

The first iteration of this set was flat-shaded colour blocks, which read as moulded plastic — because a uniform base colour under a uniform roughness *is* what plastic looks like. Surfaces now carry the four things a miniature painter does by hand, applied procedurally in `nova_surfaces.py`:

1. **Panel lining** — a 3D grid of thin seams, so every face of every part reads as assembled from panels. Three axis-aligned band sets combined; one alone smears into stripes on faces it does not face across.
2. **Recess shading** — ambient occlusion darkens where surfaces meet, the equivalent of a shade wash.
3. **Edge highlights** — convex edges rub back toward bare metal, the equivalent of drybrushed edge highlighting. This is what makes a form read as crisp.
4. **Basing pigment** — upward faces catch the board's ochre regolith, tying a piece to the ground it stands on.

Read in that order, the numbers in `SURFACE_CLASSES` are a paint recipe rather than a pile of constants. Two rules govern them:

- **Weathering stays restrained on the model and concentrated on the base.** A display piece is clean; its base is dirty. Caking the hull in dust makes a piece look abandoned rather than deployed.
- **Metallic stays low.** These are *painted* surfaces. High metallic throws away the base colour in favour of whatever the environment reflects, which collapses graphite, slate, and ceramic into one bright silver and destroys the value separation below.

### Surface classes

Materials sit at **clearly separated values**. When slate and ceramic drift close together the pieces read as uniformly white plastic instead of hardware.

| Class | Hex | Metallic | Use |
| --- | --- | --- | --- |
| `Graphite` | `#252d3d` | 0.18 | structural mass, plinths, seams |
| `Chassis` | `#66788f` | 0.22 | machinery, exposed panels, readable edges |
| `Ceramic` | `#e6dece` | 0.0 | pressure hulls |
| `Basing` | `#5c4a34` | 0.0 | the base plate's ground only; no panel seams |

Emissive accents are `FactionAccent`, `Energy`, `HazardAcid`, `ResourceOre`, and `Warning`. Emission strength stays low (0.22) — the renderer's bloom pass does the glowing, and anything higher washes the accent out to a pale tint in engine.

**Do not spend more than three accents on one piece.** The android carries faction cyan, energy amber, and ore orange; a fourth competes with the visor for attention, and acid lime on an android reads as acid *damage* rather than as the tool that removes it.

Use `add_rounded_box` for hull and machinery forms: a multi-segment chamfer with angle-limited smooth shading reads as a moulded, tooled shell, where a single-segment bevel is a hard 45° cut.

## Two hard constraints from the runtime

These are contracts, not preferences. Breaking either one breaks the board rather than merely looking wrong.

**`FactionAccent` must survive the export by name.** `tabletop-assets.ts` finds the owner's colour by looking up the material *named* `FactionAccent` and drives low-battery pulses through its emissive. Accent materials are therefore held **out of the bake** and keep their names. Bake an accent in and you get a permanently cyan android for every player.

**The lean must be paid for with a lift.** Androids rotate about their model origin, which sits at the centre of the base plate on the ground plane, so leaning into travel swings the leading rim *below* the board by `radius × sin(angle)` — about a tenth of a tile at full lean. `basePlateRadius` in `tabletop-actors.ts` compensates, and a test guards it.

## Texture pipeline

glTF carries image textures, not Blender node graphs, so the procedural surfaces are **baked**. Every part of a piece is joined per surface class, unwrapped into one shared atlas, and baked to three maps:

| Map | Size | Notes |
| --- | --- | --- |
| Base colour | 1024² | carries the detail the eye reads |
| Roughness | 512² | low frequency, halves cleanly |
| Normal | 512² | captures the procedural seams and micro relief |

**Metallic has no Cycles bake type**, so it cannot go in the atlas. Each surface class instead keeps its own material sampling the *shared* atlas and carries its own `metallicFactor` — a mesh only ever samples its own UV islands, so several materials over one atlas costs three textures, not nine.

Textures export as **WebP** at quality 92, which roughly halves the payload against PNG at a quality nobody can see on a piece a couple of hundred pixels tall. This is safe because three.js's `GLTFLoader` implements `EXT_texture_webp`. Backface culling is on: these are closed solids, so a back face is never visible, and leaving it off makes Blender write `doubleSided` and three.js dutifully draw both sides.

### Budget

This is a browser game, not a desktop engine, and the budget is part of the design:

| | Per piece | Whole set |
| --- | --- | --- |
| Triangles | 700 – 9,600 | ~34,000 |
| Draw calls | 5 – 7 | — |
| GLB size | 188 – 728 KiB | **4.5 MB across 11 pieces** |

Draw calls matter as much as triangles, because the renderer clones materials per piece: a board of twenty androids costs twenty times one android. Joining parts per surface class is what keeps sixty greebles down to four hull meshes plus accents.

If the set grows enough that per-piece atlases stop fitting the budget, the next move is **one atlas shared across the whole set** with external texture files — the surface classes are already identical between pieces, so it is a pipeline change rather than an art change.

## Gameplay silhouettes

Each piece must be identifiable by outline alone at replay distance.

| Game entity | Silhouette and key read | Accent |
| --- | --- | --- |
| Android | Compact two-legged worker, wide stance, visor, rear pack, hip ore panniers, gripper and nozzle arms | faction visor |
| Charger | U-shaped gantry over a circular pad — reads as a gate | energy + faction |
| Depot | Asymmetric stack of sealed crates | faction panel |
| Extractor | Drill derrick, four converging legs, triangular read | ore |
| Processor | Squared plant with twin tall stacks | energy |
| Acid processing plant | Contained cylindrical tank with external pipework | acid hazard + chevrons |
| Relay tower | Thin braced lattice mast with an offset dish | faction/signal |
| Scanner | Low pedestal dominated by a wide tilted dish | cyan scan light |
| Radar | Squat rotator turret under a wide flat rectangular array slab | faction emitter strips |
| Colony module | Hero piece: geodesic habitat plus annex, corridor, beacon | faction + warm colony light |
| Loose material cache | Low cargo tray, crate, canister, and mineral sample; no base plate | material-specific signal |

Pieces that share a role are the hardest to keep apart, so each one carries a different primitive. The three sight pieces are the worked example: the relay tower is a **narrow mast**, the scanner is a **round dish**, and the radar is a **flat rectangular slab**. When a new piece joins an existing family, pick the primitive none of its siblings already uses rather than restyling one of theirs.

Construction sites are not separate finished models: render the piece reduced, with a turning warning ring and rising sparks. Destroyed/salvaged buildings become scattered resource markers, not wrecked full models.

### Design the silhouette from the rules

A worker whose shape does not explain its job is decoration. Every element of the android maps to something it actually does in `packages/game/src/rules/rules.android.ts`:

| Feature | Rule |
| --- | --- |
| Wide-stance legs, heavy feet | `moveBatteryCost` |
| Open hip panniers with ore showing | `cargoCapacity` |
| Exposed cells on the rear pack | `batteryCapacity` |
| Chest status monitor | `startingHealth` |
| Nozzle arm | `cleanAcidBatteryCost`, construction |
| Gripper arm | collecting, depositing, dismantling |
| Wide sensor visor | `sight` |
| Antenna and beacon | `broadcastLimit` |

The first version of the android had nowhere to put the ore it spends the whole game carrying. Cargo rides on the **sides**, open to the sky: the board camera is a fixed three-quarter view and androids turn to face where they are walking, so a rear-mounted tray spends most of the game hidden behind the torso.

Arms are deliberately **asymmetric** — a gripper on one side, a nozzle on the other. Two identical arms read as a mannequin; different tools read as a machine built for a job, and give the piece a handedness at a glance. Tools ride at chest height, because anything held low disappears behind the pelvis from the board camera.

## Colour tokens

Use these as a starting palette. UI text and status must still meet contrast requirements against `Void`.

| Token | Hex | Use |
| --- | --- | --- |
| Void | `#050816` | page and deep-space background |
| Fog | `#070b18` | unexplored ground |
| Board | `#1f2937` | neutral terrain and panels |
| Structure dark | `#334155` | plinths, seams, inactive hardware |
| Structure light | `#94a3b8` | exposed panels and readable edges |
| System cyan | `#38bdf8` | UI and system accent — never a player |
| Energy amber | `#fbbf24` | chargers and active processing |
| Acid lime | `#a3e635` | acid and cleanup systems |
| Ore orange | `#fb923c` | ore/extraction |
| Warning coral | `#fb7185` | danger, damage, and invalid actions |

### Faction accents

Factions are assigned by seat order, so they read in the same order the scoreboard lists them. Hues are spaced to stay clear of the semantic colours above — no faction accent may sit near acid lime, ore orange, energy amber, or warning coral, or it can be mistaken for a hazard read.

| Faction | Hex | Glyph |
| --- | --- | --- |
| Cyan | `#38bdf8` | ◆ |
| Fuchsia | `#e879f9` | ● |
| Emerald | `#34d399` | ▲ |
| Indigo | `#818cf8` | ■ |
| Pink | `#f472b6` | ◇ |
| Teal | `#2dd4bf` | ▼ |

Never convey owner, active/inactive state, or hazard solely with colour. Every place an accent identifies a player, its **glyph** appears with it. Pair state with a silhouette, icon, material treatment, or motion/light change.

## UI language

- The **board is the stage**. Panels float over it as HUD: translucent, blurred, hairline-bordered, softly rounded — not a grid of boxes beside it.
- Body text is sans-serif. Monospace is reserved for **numeric data**, always tabular so digits do not shift as values change. Setting everything in mono reads as a terminal, not a game.
- Micro uppercase labels are used sparingly, for panel titles and units only.
- Reserve vivid colours for meaning; the page background stays plain so the board's own grid is the only grid.
- The **scoreboard shows the score**, with a share meter and a lead marker. The contributor breakdown is a detail you ask for by clicking, not something crowding the board.
- The **inspector** is contextual: a tile shows its ground, hazards, and clickable lists of what stands on it; an android or building shows its own status, meters, cargo/storage, and programme.
- The **timeline is the primary verb** of a replay and gets designed as such: transport buttons, a scrubber with a tick per round, playback speed, a summary of what happened this round, and keyboard shortcuts (space, arrows, Home/End, Escape).
- Replay summaries use the same action verbs as the rulebook: move, collect, charge, construct, salvage, broadcast, clean acid.
- Each building/action icon must reuse the corresponding 3D silhouette or accent colour.

## Motion and effects

Uniform exponential easing on everything reads as mushy. Motion should have weight.

- Pieces **arrive** with an overshoot and land with a dust puff; they leave by sinking and fading with another puff.
- A **deactivated android** is the exception: it topples where it stood, its accent glow drains as it falls, and only then does it fade. A death should read as one, not as a piece being tidied away. The wreck stays in the world data, but never on the board.
- Androids rotate toward their next orthogonal move, lean into travel, and gain a gait bob that scales with speed. Do not make them walk like realistic characters yet. Remember that the lean must lift (see the runtime constraints above).
- Active energy uses a slow pulse; scanners, radars, and relays use a restrained sweep or ping.
- **Low battery** pulses the owner's accent emissive rather than recolouring it, so a status read never overwrites ownership.
- Construction shows a slowly turning warning ring plus sparks.
- Acid can shimmer or emit sparse particles, but its tile value and occupancy must remain visible. Pools on adjacent tiles merge into one body of liquid rather than showing a seam.
- Every easing is written as `1 - exp(-k * delta)`, which requires a **non-negative, clamped delta**. An unclamped frame delta inverts the easing and drives transforms to NaN.

## Offline capture

The renderer can be driven frame by frame instead of from its own animation loop, for tools like Remotion:

- `autoPlay: false` suppresses the internal `requestAnimationFrame` loop and renders one initial frame.
- `advance(deltaSeconds)` steps every animation and renders exactly one frame — call it once per output frame with `1 / fps`.
- Particle motion uses a seeded PRNG, so separately rendered chunks of the same timeline match.

## Asset delivery rules

The pipeline is three modules and two generators, split so a piece cannot be exported under different rules from the rest of the set:

| File | Owns |
| --- | --- |
| `nova_kit.py` | geometry primitives, family motifs, the base plate |
| `nova_surfaces.py` | surface classes, accents, and the bake |
| `nova_build.py` | scene setup, review lighting, render, export, budget report, shared CLI |
| `generate-nova-pieces.py` | the ten buildings and the material cache — geometry only |
| `generate-android.py` | the android's parametric design and its unchosen variants |

- Editable Blender sources live in `packages/renderer/blender/source/`.
- Runtime assets are named in kebab case and exported as individual GLB files to `packages/renderer/assets/models/`.
- Generate a matching PNG preview in `packages/renderer/assets/previews/` for every exported model so pieces can be reviewed without opening Blender.
- Review the **set**, not just single pieces: `--contact-sheet` renders every piece in one orthographic row so the family can be judged for coherence and silhouette distinctness at a glance.
- Apply transforms before export; export only the piece, its materials, and its root—not lights, cameras, or unused scene objects.
- Keep generated geometry deterministic — grit and ore scatter use seeded PRNGs. Commit a generator alongside every exported model.

### Reviewing honestly

`--lighting engine` (the default) mirrors the rig in `tabletop-renderer.ts`: hemisphere, key, rim, warm bounce, and a glare pass standing in for `UnrealBloomPass`. A Blender studio rig makes any model look better than the game will, which is worse than useless when the question is "how will this feel in play".

`--lighting studio` exists for the other question — whether the base plate's ochre and the faction accent are actually the colours intended — and renders with the `Standard` view transform because Filmic desaturates.

One camera and one lighting rig serve the whole set. A family can only be judged for coherence if every piece is photographed the same way.
