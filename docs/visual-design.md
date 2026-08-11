# Project Nova visual design

## Design intent

Project Nova is a **premium physical tabletop game brought to life digitally**: sturdy, readable low-poly frontier sci-fi pieces on a hostile alien board. The visual direction is **frontier NASA-punk**—ceramic pressure hulls, powder-coated graphite machinery, exposed energy hardware, and optimistic colony technology—not generic military hardware or photorealistic machinery. The presentation must make one-tile actions, ownership, hazards, and infrastructure roles legible at a glance.

The visual hierarchy is always:

1. **Board state** — tile boundaries, terrain, and hazards
2. **Gameplay pieces** — androids and buildings, distinguished by silhouette
3. **Ownership and status** — colour accents, light, and concise overlays
4. **Atmosphere** — restrained effects that never obscure state

## Source of truth

`packages/renderer/src/nova-palette.ts` owns the colour language. The renderer reads it as three.js colours; `apps/web/src/app.css` mirrors it as Tailwind theme tokens; `packages/renderer/blender/scripts/nova_kit.py` mirrors the material subset as sRGB hex. Change the palette there first — a piece on the board and its row in the scoreboard must never disagree about who owns what.

## World and camera

- Use an orthographic or near-orthographic, three-quarter tabletop camera.
- The board grid is the unit of measure: a standard piece fits inside **1 × 1 tile**.
- Blender models use metres as game units, Z-up, and face local **+Y**. Their origin sits at tile centre on the ground plane.
- Keep standard buildings below 0.9 tile units tall; tall elements may reach 1.2 only when they are deliberately narrow (relay tower, scanner).
- Avoid texture-dependent detail. Forms, material blocks, and a small number of emissive accents must carry the design at replay-viewer distance.
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

## Piece language

All pieces share these traits:

- low-poly, flat-shaded surfaces; no photorealism
- a dark, double-tier graphite plinth, always the widest thing at ground level — nothing may overhang it
- a faction inlay along the piece's front edge, so ownership is readable from directly above where hull accents are hidden
- a `StructureLight` collar where the hull meets the plinth: the family's repeated joint detail
- warm off-white ceramic pressure hulls over desaturated alloy chassis panels
- one strong functional or faction accent, plus a small exposed core, ring, or monitor
- broad chamfers and chunky, collectible-miniature proportions
- purposeful asymmetry only where it indicates direction or function

Materials sit at **three clearly separated values** — graphite mass, slate machinery, ceramic hull. When slate and ceramic drift close together the pieces read as uniformly white plastic instead of hardware. Emission is kept low; the renderer's bloom pass does the glowing.

The canonical Blender materials are `StructureDark`, `StructureLight`, `Ceramic`, `FactionAccent`, `Energy`, `HazardAcid`, `ResourceOre`, and `Warning`. `FactionAccent` is replaced or tinted per owner by the renderer; do not export a distinct model for each player.

## Gameplay silhouettes

Each piece must be identifiable by outline alone at replay distance.

| Game entity           | Silhouette and key read                                        | Accent                      |
| --------------------- | -------------------------------------------------------------- | --------------------------- |
| Android               | Compact two-legged worker, wide stance, visor and rear pack    | faction visor               |
| Charger               | U-shaped gantry over a circular pad — reads as a gate          | energy + faction            |
| Depot                 | Asymmetric stack of sealed crates                              | faction panel               |
| Extractor             | Drill derrick, four converging legs, triangular read           | ore                         |
| Processor             | Squared plant with twin tall stacks                            | energy                      |
| Acid processing plant | Contained cylindrical tank with external pipework              | acid hazard + chevrons      |
| Relay tower           | Thin braced lattice mast with an offset dish                   | faction/signal              |
| Scanner               | Low pedestal dominated by a wide tilted dish                   | cyan scan light             |
| Radar                 | Squat rotator turret under a wide flat rectangular array slab  | faction emitter strips      |
| Colony module         | Hero piece: geodesic habitat plus annex, corridor, beacon      | faction + warm colony light |
| Loose material cache  | Low cargo tray, crate, canister, and mineral sample; no plinth | material-specific signal    |

Pieces that share a role are the hardest to keep apart, so each one carries a different primitive. The three sight pieces are the worked example: the relay tower is a **narrow mast**, the scanner is a **round dish**, and the radar is a **flat rectangular slab**. When a new piece joins an existing family, pick the primitive none of its siblings already uses rather than restyling one of theirs.

Construction sites are not separate finished models: render the piece reduced, with a turning warning ring and rising sparks. Destroyed/salvaged buildings become scattered resource markers, not wrecked full models.

## Colour tokens

Use these as a starting palette. UI text and status must still meet contrast requirements against `Void`.

| Token           | Hex       | Use                                   |
| --------------- | --------- | ------------------------------------- |
| Void            | `#050816` | page and deep-space background        |
| Fog             | `#070b18` | unexplored ground                     |
| Board           | `#1f2937` | neutral terrain and panels            |
| Structure dark  | `#334155` | plinths, seams, inactive hardware     |
| Structure light | `#94a3b8` | exposed panels and readable edges     |
| System cyan     | `#38bdf8` | UI and system accent — never a player |
| Energy amber    | `#fbbf24` | chargers and active processing        |
| Acid lime       | `#a3e635` | acid and cleanup systems              |
| Ore orange      | `#fb923c` | ore/extraction                        |
| Warning coral   | `#fb7185` | danger, damage, and invalid actions   |

### Faction accents

Factions are assigned by seat order, so they read in the same order the scoreboard lists them. Hues are spaced to stay clear of the semantic colours above — no faction accent may sit near acid lime, ore orange, energy amber, or warning coral, or it can be mistaken for a hazard read.

| Faction | Hex       | Glyph |
| ------- | --------- | ----- |
| Cyan    | `#38bdf8` | ◆     |
| Fuchsia | `#e879f9` | ●     |
| Emerald | `#34d399` | ▲     |
| Indigo  | `#818cf8` | ■     |
| Pink    | `#f472b6` | ◇     |
| Teal    | `#2dd4bf` | ▼     |

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
- Androids rotate toward their next orthogonal move, lean into travel, and gain a gait bob that scales with speed. Do not make them walk like realistic characters yet.
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

- Generator scripts live in `packages/renderer/blender/scripts/`; shared primitives, materials, and family motifs live in `nova_kit.py`.
- Editable Blender sources live in `packages/renderer/blender/source/`.
- Runtime assets are named in kebab case and exported as individual GLB files to `packages/renderer/assets/models/`.
- Generate a matching 512 × 512 PNG preview in `packages/renderer/assets/previews/` for every exported model so pieces can be reviewed without opening Blender.
- Review the **set**, not just single pieces: `--contact-sheet` renders every piece in one row so the family can be judged for coherence and silhouette distinctness at a glance.
- Apply transforms before export; export only the piece, its materials, and its root—not lights, cameras, or unused scene objects.
- Keep generated geometry deterministic. Commit a generator alongside every exported model.
