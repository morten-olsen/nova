"""Shared build machinery for Project Nova's pieces.

Piece generators here describe *geometry* and nothing else. Everything that
happens to a piece after it is modelled — unwrapping, baking, texture
compression, review lighting, the preview render, the GLB export, and the budget
report — is identical for every piece and lives here, so the set cannot drift into
pieces that were exported under different rules.

The review camera and lighting are deliberately fixed for the whole set: a family
can only be judged for coherence if every piece is photographed the same way.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import bpy
from mathutils import Vector

from nova_surfaces import (
    SURFACE_NAMES,
    apply_baked_surfaces,
    bake_surface_atlas,
    join_by_surface,
)

# --------------------------------------------------------------------------
# scene housekeeping
# --------------------------------------------------------------------------


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.materials, bpy.data.images, bpy.data.meshes, bpy.data.node_groups):
        for item in list(collection):
            collection.remove(item)


def select_objects(objects: list[bpy.types.Object]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for object in objects:
        object.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def point_at(object: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - object.location
    object.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def mesh_objects() -> list[bpy.types.Object]:
    return [object for object in bpy.context.scene.objects if object.type == "MESH"]


# --------------------------------------------------------------------------
# review lighting
# --------------------------------------------------------------------------

# Mirrors `createLighting` in tabletop-renderer.ts. A Blender studio rig makes any
# model look better than the game will, which is worse than useless when the
# question being asked is "how will this feel in play".
ENGINE_SKY_COLOUR = (0xBC / 255, 0xD0 / 255, 0xE0 / 255)
ENGINE_GROUND_COLOUR = (0x3A / 255, 0x2E / 255, 0x22 / 255)
ENGINE_SUNS = (
    # The engine's light positions, with three.js Y-up swapped to Blender Z-up.
    ((5, -4, 10), (1.0, 0.95, 0.86), 3.6),
    ((-5, 4.5, 4.5), (0.35, 0.66, 1.0), 1.25),
    ((0, -6, 2), (1.0, 0.75, 0.53), 0.30),
)


def add_engine_lighting(target: tuple[float, float, float]) -> None:
    for direction, colour, strength in ENGINE_SUNS:
        bpy.ops.object.light_add(type="SUN", location=direction)
        light = bpy.context.object
        light.data.energy = strength
        light.data.color = colour
        light.data.angle = 0.09
        point_at(light, target)


def add_studio_lighting(target: tuple[float, float, float]) -> None:
    """A product shot: key, cool fill, and a rim to pull the silhouette off the
    backdrop. Useful for judging sculpt quality, not for judging how it plays."""
    for location, energy, size, colour in (
        ((2.2, -2.6, 3.2), 700, 3.2, (1.0, 0.92, 0.80)),
        ((-3.0, -0.6, 1.7), 90, 3.0, (0.55, 0.68, 0.95)),
        ((0.2, 3.0, 2.4), 260, 2.2, (0.35, 0.60, 1.0)),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.data.energy = energy
        light.data.size = size
        light.data.color = colour
        point_at(light, target)


def configure_hemisphere_world(strength: float) -> None:
    """A sky/ground gradient standing in for three.js `HemisphereLight`.

    The engine's hemisphere is bright (2.1) and does much of the work of filling
    shadow, so leaving it out would make pieces read far more contrasty than they
    will on the board.
    """
    world = bpy.context.scene.world
    world.use_nodes = True
    tree = world.node_tree
    tree.nodes.clear()
    background = tree.nodes.new("ShaderNodeBackground")
    background.inputs["Strength"].default_value = strength
    output = tree.nodes.new("ShaderNodeOutputWorld")

    coordinates = tree.nodes.new("ShaderNodeTexCoord")
    separate = tree.nodes.new("ShaderNodeSeparateXYZ")
    tree.links.new(coordinates.outputs["Normal"], separate.inputs["Vector"])
    ramp = tree.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (*ENGINE_GROUND_COLOUR, 1.0)
    ramp.color_ramp.elements[1].position = 1.0
    ramp.color_ramp.elements[1].color = (*ENGINE_SKY_COLOUR, 1.0)
    # Normal Z runs -1..1; remap so the horizon sits at the ramp's midpoint.
    remap = tree.nodes.new("ShaderNodeMath")
    remap.operation = "MULTIPLY_ADD"
    remap.inputs[1].default_value = 0.5
    remap.inputs[2].default_value = 0.5
    tree.links.new(separate.outputs["Z"], remap.inputs[0])
    tree.links.new(remap.outputs["Value"], ramp.inputs["Fac"])
    tree.links.new(ramp.outputs["Color"], background.inputs["Color"])
    tree.links.new(background.outputs["Background"], output.inputs["Surface"])


def add_bloom_glare(threshold: float = 0.82, strength: float = 0.30) -> None:
    """Approximates the renderer's `UnrealBloomPass` (strength 0.22).

    Without it the emissive accents read flat and too dark, which would push the
    design toward over-bright accents that then blow out in game.

    Blender 5 moved compositing to a node group hung off the scene and turned the
    Glare node's settings into sockets whose menu values are title case; Blender 4
    used `scene.node_tree` with properties, so both paths are kept.
    """
    scene = bpy.context.scene
    scene.use_nodes = True

    if hasattr(scene, "compositing_node_group"):
        group = bpy.data.node_groups.new("Bloom", "CompositorNodeTree")
        group.interface.new_socket("Image", in_out="INPUT", socket_type="NodeSocketColor")
        group.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        group_input = group.nodes.new("NodeGroupInput")
        group_output = group.nodes.new("NodeGroupOutput")
        glare = group.nodes.new("CompositorNodeGlare")
        glare.inputs["Type"].default_value = "Bloom"
        glare.inputs["Quality"].default_value = "High"
        glare.inputs["Threshold"].default_value = threshold
        glare.inputs["Strength"].default_value = strength
        group.links.new(group_input.outputs[0], glare.inputs["Image"])
        group.links.new(glare.outputs["Image"], group_output.inputs[0])
        scene.compositing_node_group = group
        return

    tree = scene.node_tree
    tree.nodes.clear()
    layers = tree.nodes.new("CompositorNodeRLayers")
    glare = tree.nodes.new("CompositorNodeGlare")
    glare.glare_type = "BLOOM"
    glare.quality = "HIGH"
    glare.mix = -0.72
    glare.threshold = threshold
    composite = tree.nodes.new("CompositorNodeComposite")
    tree.links.new(layers.outputs["Image"], glare.inputs["Image"])
    tree.links.new(glare.outputs["Image"], composite.inputs["Image"])


def add_review_floor() -> None:
    material = bpy.data.materials.new("Review floor")
    material.use_nodes = True
    principled = material.node_tree.nodes["Principled BSDF"]
    principled.inputs["Base Color"].default_value = (0.006, 0.008, 0.013, 1.0)
    principled.inputs["Metallic"].default_value = 0.0
    # A touch of sheen: a display piece is photographed on a surface, and the
    # faint reflection is much of what reads as "premium". Kept dark and rough —
    # the plane is 60 units across, so anything brighter stops being a floor and
    # becomes a backdrop that washes the piece out.
    principled.inputs["Roughness"].default_value = 0.60
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0.0))
    floor = bpy.context.object
    floor.name = "Review floor"
    floor.data.materials.append(material)


def setup_scene_lighting(target: tuple[float, float, float], lighting: str, bloom: bool = True) -> None:
    if lighting == "studio":
        add_studio_lighting(target)
        return
    configure_hemisphere_world(0.42)
    add_engine_lighting(target)
    if bloom:
        add_bloom_glare()


# --------------------------------------------------------------------------
# rendering
# --------------------------------------------------------------------------


def configure_render(filepath: Path, width: int, height: int, samples: int, lighting: str) -> None:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.filepath = str(filepath)
    # The engine tone-maps ACES at 1.05 exposure. Blender ships no ACES view
    # transform and AgX lifts shadows far more than ACES does, so Filmic plus the
    # engine's exposure is the closest honest match available.
    #
    # The studio shot uses Standard instead: Filmic desaturates, and that render's
    # job is to judge whether the base plate's ochre and the faction accent are
    # actually the colours intended.
    if lighting == "studio":
        scene.view_settings.view_transform = "Standard"
        scene.view_settings.exposure = 0.0
    else:
        scene.view_settings.view_transform = "Filmic"
        scene.view_settings.exposure = 0.07


# One camera for the whole set, so pieces can be compared rather than merely
# admired individually.
REVIEW_CAMERA = (1.55, -1.95, 1.30)
REVIEW_TARGET = (0.0, 0.0, 0.40)
REVIEW_LENS = 72


def render_preview(name: str, preview_dir: Path, samples: int, lighting: str, bloom: bool = True) -> None:
    configure_render(preview_dir / f"{name}.png", 900, 900, samples, lighting)
    add_review_floor()
    setup_scene_lighting((0, 0, 0.42), lighting, bloom)
    bpy.ops.object.camera_add(location=REVIEW_CAMERA)
    camera = bpy.context.object
    camera.data.lens = REVIEW_LENS
    point_at(camera, REVIEW_TARGET)
    bpy.context.scene.camera = camera
    bpy.ops.render.render(write_still=True)


def render_contact_sheet(
    filepath: Path, count: int, spacing: float, samples: int, lighting: str, bloom: bool = True
) -> None:
    """An orthographic row of everything currently in the scene.

    Orthographic on purpose: with perspective, the pieces nearest the camera look
    bigger and the family cannot be judged for consistent scale.
    """
    centre = (0.0, 0.0, 0.44)
    # Width scales with the number of pieces so each one keeps a usable share of
    # the frame: a fixed width that reads well for three variants gives eleven
    # pieces about a hundred pixels each, which is too small to judge anything.
    view_width = count * spacing + 0.1
    width = min(3200, max(1200, 600 * count))
    height = int(width / view_width * 1.35)
    configure_render(filepath, width, height, samples, lighting)
    add_review_floor()
    setup_scene_lighting(centre, lighting, bloom)
    bpy.ops.object.camera_add(location=(centre[0], centre[1] - 5.0, 2.35))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = count * spacing + 0.1
    point_at(camera, centre)
    bpy.context.scene.camera = camera
    bpy.ops.render.render(write_still=True)


# --------------------------------------------------------------------------
# bake, export, report
# --------------------------------------------------------------------------


def report_budget(name: str, objects: list[bpy.types.Object], glb: Path) -> None:
    """Print the numbers that decide whether a piece ships in a browser.

    Draw calls matter as much as triangles: the renderer clones materials per
    piece, so a board of twenty is twenty times whatever this says.
    """
    triangles = 0
    for object in objects:
        mesh = object.data
        mesh.calc_loop_triangles()
        triangles += len(mesh.loop_triangles)
    size = glb.stat().st_size / 1024
    print(f"NOVA: built {name} — {triangles} tris, {len(objects)} draw calls, {size:.0f} KiB GLB")


def finish_piece(name: str, options: argparse.Namespace) -> None:
    """Turn a freshly modelled scene into a committed, textured game piece.

    Everything from here is uniform across the set: parts are joined per surface
    class, unwrapped into one shared atlas, baked, re-materialised against the
    baked maps, previewed, and exported.
    """
    joined = join_by_surface(mesh_objects())
    # Accent meshes are excluded from the bake so their material names — and so
    # the runtime's grip on ownership and status — survive the export.
    surface_names = [surface for surface in joined if surface in SURFACE_NAMES]
    hulls = [joined[surface] for surface in surface_names]

    images = bake_surface_atlas(hulls, name, size=options.texture_size, samples=options.samples)
    apply_baked_surfaces({surface: joined[surface] for surface in surface_names}, images)
    for image in images.values():
        # Packed rather than written beside the model: the GLB embeds them, so
        # loose files in assets/models would be uncommitted duplicates.
        image.pack()
        if options.dump_maps:
            path = options.preview_dir / f"{name}-{image.name.rsplit('-', 1)[-1]}.png"
            image.filepath_raw = str(path)
            image.file_format = "PNG"
            image.save()

    piece_objects = mesh_objects()
    # Backface culling halves the fragment work and costs nothing: these are
    # closed solids, so a back face is never visible. Left off, Blender exports
    # `doubleSided` and three.js dutifully draws both sides.
    for object in piece_objects:
        for material in object.data.materials:
            material.use_backface_culling = True

    select_objects(piece_objects)
    bpy.ops.wm.save_as_mainfile(filepath=str(options.source_dir / f"{name}.blend"))

    render_preview(name, options.preview_dir, options.render_samples, options.lighting, not options.no_bloom)

    glb = options.output_dir / f"{name}.glb"
    select_objects(piece_objects)
    bpy.ops.export_scene.gltf(
        filepath=str(glb),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        # WebP roughly halves the texture payload against PNG at a quality no one
        # can see on a piece a couple of hundred pixels tall. Safe because
        # three.js's GLTFLoader implements EXT_texture_webp, which is how a
        # WebP-textured glTF is read at all.
        export_image_format="WEBP",
        export_image_quality=92,
    )
    report_budget(name, piece_objects, glb)


# --------------------------------------------------------------------------
# shared CLI
# --------------------------------------------------------------------------


def add_common_arguments(parser: argparse.ArgumentParser, root: Path) -> None:
    parser.add_argument("--contact-sheet", action="store_true", help="Render the set in one row and stop")
    # 1024 is the web budget, not a compromise: a piece is a couple of hundred
    # pixels tall on the board, and three maps per piece across the whole set is
    # what the download actually costs.
    parser.add_argument("--texture-size", type=int, default=1024)
    parser.add_argument("--samples", type=int, default=24, help="Cycles samples per baked map")
    parser.add_argument("--render-samples", type=int, default=96, help="Cycles samples for preview renders")
    parser.add_argument(
        "--lighting",
        choices=("engine", "studio"),
        default="engine",
        help="engine mirrors the three.js rig; studio is a flattering product shot",
    )
    parser.add_argument("--no-bloom", action="store_true", help="Skip the glare pass standing in for UnrealBloomPass")
    parser.add_argument("--dump-maps", action="store_true", help="Also write the baked atlas beside the previews")
    parser.add_argument("--output-dir", type=Path, default=root / "assets" / "models")
    parser.add_argument("--preview-dir", type=Path, default=root / "assets" / "previews")
    parser.add_argument("--source-dir", type=Path, default=root / "blender" / "source")


def prepare_directories(options: argparse.Namespace) -> None:
    for directory in (options.output_dir, options.preview_dir, options.source_dir):
        directory.mkdir(parents=True, exist_ok=True)
