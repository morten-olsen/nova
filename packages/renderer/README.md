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

1. Write a deterministic Blender Python generator in `blender/scripts/`.
2. Run it in Blender to create or update an editable `.blend` source file in `blender/source/`.
3. Render a PNG turntable-style preview to `assets/previews/` and export the game-ready `.glb` model to `assets/models/`.
4. Commit the generator, preview, and exported model together. Commit `.blend` files only when they contain manual work that the generator cannot reproduce.

Models use a 1 × 1 game-tile footprint, Z-up coordinates, and low-poly geometry. Player-specific colour belongs in Three.js at runtime, not in separate model exports.

## Directories

- `blender/scripts/` — version-controlled `bpy` generation and export scripts
- `blender/source/` — editable Blender source files
- `assets/models/` — exported runtime GLB models
- `assets/previews/` — PNG previews for quick asset review

Generate the starter pieces from the repository root:

```sh
blender --background --python packages/renderer/blender/scripts/generate-nova-pieces.py
```

The canonical art direction lives in [`docs/visual-design.md`](../../docs/visual-design.md).
