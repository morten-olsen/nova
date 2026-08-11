# Nova renderer

This workspace owns Project Nova's Three.js tabletop renderer and its low-poly assets.

## Renderer

The renderer is a deep module with one browser-facing interface:

```ts
const renderer = createTabletopRenderer(hostElement);
renderer.setWorld(world);
renderer.dispose();
```

`setWorld` diffs game-world snapshots, loads the matching GLB pieces, and animates movement, placement, removal, construction scale, and co-occupied tiles. Pieces intentionally occupy 78% of a tile while alone; shared tiles shrink pieces to 56% (or 45% for three or more) and pack them farther apart. It uses deterministic per-tile packing rather than a physics engine: this keeps replay animation reproducible while still moving a building aside when one or more androids share its tile, then returning it to centre when the tile clears.

Tiles intentionally use one neutral material for this first renderer milestone. Terrain, resources, hazards, and selection treatment are a later rendering pass.

## Asset pipeline

Pieces are display-quality miniatures on base plates, textured by baking
procedural surfaces down to images. The pipeline is split so that a piece cannot
be exported under different rules from the rest of the set:

| File | Owns |
| --- | --- |
| `blender/scripts/nova_kit.py` | geometry primitives, family motifs, the base plate |
| `blender/scripts/nova_surfaces.py` | surface classes, emissive accents, and the bake |
| `blender/scripts/nova_build.py` | scene setup, review lighting, render, export, budget report |
| `blender/scripts/generate-nova-pieces.py` | the ten buildings and the material cache |
| `blender/scripts/generate-android.py` | the android and its unchosen design variants |

A generator describes geometry; everything after modelling is uniform. Parts are
joined per surface class, unwrapped into one shared UV atlas, baked to base
colour, roughness, and normal maps, then exported as a GLB with WebP textures.

**glTF carries image textures, not Blender node graphs**, which is why the bake
exists. Two rules follow from the runtime and are not negotiable:

- The material named `FactionAccent` is how the renderer finds the owner's colour,
  so accent materials stay **out of the bake** and keep their names.
- Metallic has no Cycles bake type, so each surface class keeps its own material
  sampling the shared atlas and carries its own `metallicFactor`.

Models use a 1 × 1 game-tile footprint, Z-up coordinates, and an origin at the
centre of the base plate on the ground plane. Player-specific colour belongs in
Three.js at runtime, not in separate model exports.

Commit the generator, preview, and exported model together. Commit `.blend` files
only when they contain manual work the generator cannot reproduce.

## Directories

- `blender/scripts/` — version-controlled `bpy` generation and export scripts
- `blender/source/` — editable Blender source files
- `assets/models/` — exported runtime GLB models
- `assets/previews/` — PNG previews for quick asset review

Generate the set from the repository root:

```sh
blender --background --factory-startup --python packages/renderer/blender/scripts/generate-nova-pieces.py
blender --background --factory-startup --python packages/renderer/blender/scripts/generate-android.py
```

Each run prints per-piece triangles, draw calls, and GLB size. Judge the family,
not one piece, with `-- --contact-sheet`.

The canonical art direction lives in [`docs/visual-design.md`](../../docs/visual-design.md). For the full path from a new game rule to a piece on the board, see [`docs/ADDING-BUILDINGS.md`](../../docs/ADDING-BUILDINGS.md).
