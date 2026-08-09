# Project Nova visual design

## Design intent

Project Nova is a **premium physical tabletop game brought to life digitally**: sturdy, readable low-poly game pieces on a hostile alien board. The presentation must make one-tile actions, ownership, hazards, and infrastructure roles legible at a glance—not simulate realistic machinery.

The visual hierarchy is always:

1. **Board state** — tile boundaries, terrain, and hazards
2. **Gameplay pieces** — androids and buildings, distinguished by silhouette
3. **Ownership and status** — colour accents, light, and concise overlays
4. **Atmosphere** — restrained effects that never obscure state

## World and camera

- Use an orthographic or near-orthographic, three-quarter tabletop camera.
- The board grid is the unit of measure: a standard piece fits inside **1 × 1 tile**.
- Blender models use metres as game units, Z-up, and face local **+Y**. Their origin sits at tile centre on the ground plane.
- Keep standard buildings below 0.9 tile units tall; tall elements may reach 1.2 only when they are deliberately narrow (relay tower, scanner).
- Avoid texture-dependent detail. Forms, material blocks, and a small number of emissive accents must carry the design at replay-viewer distance.

## Piece language

All pieces share these traits:

- low-poly, flat or lightly faceted surfaces; no photorealism
- a dark graphite plinth or feet grounding the piece to its tile
- desaturated alloy body panels, with one strong functional or faction accent
- broad bevels and chunky, toy-like proportions
- purposeful asymmetry only where it indicates direction or function

The canonical Blender materials are `StructureDark`, `StructureLight`, `FactionAccent`, `Energy`, `HazardAcid`, `ResourceOre`, and `Warning`. `FactionAccent` is replaced or tinted per owner by the renderer; do not export a distinct model for each player.

## Gameplay silhouettes

| Game entity | Silhouette and key read | Accent |
| --- | --- | --- |
| Android | Compact two-legged worker with a sensor head and rear pack | faction stripe/sensor |
| Charger | U-shaped charging gantry over a circular pad | energy + faction |
| Depot | Low rectangular storage crate stack | faction panel |
| Extractor | Ground drill and angled support arms | ore |
| Processor | Squared plant with twin exhaust stacks | energy |
| Acid processing plant | Contained cylindrical tank and external pipes | acid hazard |
| Relay tower | Thin mast with a directional dish | faction/signal |
| Scanner | Low pedestal with a wide sensor dish | cyan scan light |
| Colony module | Largest piece: habitat dome with a beacon | faction + warm colony light |

Construction sites are not separate finished models: render a low plinth, visible structural frame, and a striped warning marker. Destroyed/salvaged buildings become scattered resource markers, not wrecked full models.

## Colour tokens

Use these as a starting palette. UI text and status must still meet contrast requirements against `Void`.

| Token | Hex | Use |
| --- | --- | --- |
| Void | `#050816` | page and deep-space background |
| Board | `#1F2937` | neutral terrain and panels |
| Structure dark | `#334155` | plinths, seams, inactive hardware |
| Structure light | `#94A3B8` | exposed panels and readable edges |
| Faction cyan | `#38BDF8` | default player/accent example |
| Energy amber | `#FBBF24` | chargers and active processing |
| Acid lime | `#A3E635` | acid and cleanup systems |
| Ore orange | `#FB923C` | ore/extraction |
| Warning coral | `#FB7185` | danger, damage, and invalid actions |

Never convey owner, active/inactive state, or hazard solely with colour. Pair it with a silhouette, icon, material treatment, or motion/light change.

## UI language

- Use the same dark board palette in UI; reserve vivid colours for meaning.
- Panels are matte, softly rounded, and separated with subtle slate borders—not heavy shadows or glass blur.
- Use compact labels, mono or tabular numerals for simulation data, and sentence-case headings.
- Each building/action icon must reuse the corresponding 3D silhouette or accent colour.
- Replay events should use the same action verbs as the rulebook: move, collect, charge, construct, salvage, broadcast, clean acid.

## Motion and effects

- Androids rotate toward their next orthogonal move and ease tile-to-tile; do not make them walk like realistic characters yet.
- Active energy uses a slow pulse; scanners and relays use a restrained sweep or ping.
- Acid can shimmer or emit sparse particles, but its tile value and occupancy must remain visible.
- On selection, use a thin tile outline or raised ring rather than obscuring the piece.

## Asset delivery rules

- Generator scripts live in `packages/renderer/blender/scripts/`.
- Editable Blender sources live in `packages/renderer/blender/source/`.
- Runtime assets are named in kebab case and exported as individual GLB files to `packages/renderer/assets/models/`.
- Generate a matching 512 × 512 PNG preview in `packages/renderer/assets/previews/` for every exported model so pieces can be reviewed without opening Blender.
- Apply transforms before export; export only the piece, its materials, and its root—not lights, cameras, or unused scene objects.
- Keep generated geometry deterministic. Commit a generator alongside every exported model.
