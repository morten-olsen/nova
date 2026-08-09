# Nova renderer

This workspace will own Project Nova's tabletop renderer. It is intentionally asset-only until the renderer is moved out of `apps/web`.

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
