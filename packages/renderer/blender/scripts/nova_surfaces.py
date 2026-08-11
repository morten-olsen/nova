"""Textured surface system for Project Nova's pieces.

The low-poly kit in `nova_kit.py` gives every piece flat colour blocks. That
reads as moulded plastic, because plastic is exactly what a uniform base colour
under a uniform roughness looks like.

The target is not a battered field robot: it is a **premium painted miniature on
a base plate**, the sort of piece a collector's-edition sci-fi board game ships.
That target is what sets every value here, and it is convenient, because the four
effects this module adds procedurally are the same four things a miniature
painter does by hand:

  * **panel seams** — a manufactured object is assembled from panels (panel lining)
  * **recess shading** — occlusion darkens where surfaces meet (a shade wash)
  * **edge highlights** — convex edges catch light and rub back toward bare metal
    (drybrushed edge highlighting), which is what makes a form read as crisp
  * **basing pigment** — upward faces catch the board's ochre regolith, heaviest
    on the base plate itself, tying the piece to the ground it stands on

Read in that order, the values below are a paint recipe rather than a pile of
magic numbers. Weathering stays deliberately restrained on the model and is
concentrated on the base: a display piece is clean, its base is dirty.

None of that survives a glTF export on its own: the exporter writes image
textures, not Blender node graphs. So the graphs here are **baked** into a
shared UV atlas (base colour, roughness, normal) and the piece ships sampling
those images.

Two constraints from the runtime shape this module, and breaking either one
breaks the board rather than merely looking wrong:

  * `tabletop-assets.ts` finds the owner's colour by looking up the material
    **named** `FactionAccent`, and drives low-battery pulses through its
    emissive. Accent materials therefore stay *out* of the bake and keep their
    names — a baked-in accent would be a permanently cyan android.
  * Metallic has no Cycles bake type, so it cannot go in the atlas. Instead each
    surface class keeps its own material sampling the *shared* atlas and carries
    its own `metallicFactor`. A mesh only ever samples its own UV islands, so
    three materials over one atlas costs three textures total, not nine.
"""

from __future__ import annotations

from dataclasses import dataclass

import bpy

# Regolith ochre. Basing pigment on upward faces is sampled toward this, so a
# piece picks up the colour of the board it stands on.
DUST_COLOUR = "#8a6a45"

# The metal an edge highlight rubs back to. Brighter and less saturated than any
# structure colour, so a highlight reads as caught light rather than as a stain.
WORN_METAL_COLOUR = "#b9c2cf"

# Micro-detail frequency, in cycles per game unit. High enough to read as surface
# tooth at replay distance; a lower frequency turns into blotching once the piece
# is only a couple of hundred pixels tall.
MICRO_NOISE_SCALE = 42.0


@dataclass(frozen=True)
class SurfaceClass:
    """One material value in the set, plus how it weathers.

    Kept as data rather than three near-identical node-graph functions: the
    difference between ceramic and graphite is a handful of numbers, and reading
    them side by side is how the three stay clearly separated in value.
    """

    name: str
    base_colour: str
    metallic: float
    roughness: float
    panel_scale: float
    panel_depth: float
    wear: float
    grime: float
    dust: float


# Three clearly separated values carried over from the low-poly set — graphite
# mass, slate machinery, ceramic hull — plus the base plate's textured top.
#
# Dust is low on all three model surfaces and high only on `Basing`. That split
# is the whole "display piece" read: a collector's miniature is crisply painted
# and stands on a gritty, pigment-heavy base. Caking the robot in dust too makes
# it look abandoned rather than deployed.
SURFACE_CLASSES = (
    SurfaceClass(
        name="Ceramic",
        base_colour="#e6dece",
        metallic=0.0,
        roughness=0.42,
        panel_scale=13.0,
        panel_depth=0.38,
        wear=0.26,
        grime=0.40,
        dust=0.20,
    ),
    SurfaceClass(
        name="Chassis",
        base_colour="#66788f",
        # Low metallic on purpose. These are *painted* surfaces, and a high
        # metallic value throws away the base colour in favour of whatever the
        # environment reflects — which collapsed graphite, slate, and ceramic
        # into one bright silver and undid the three separated values entirely.
        metallic=0.22,
        roughness=0.36,
        panel_scale=19.0,
        panel_depth=0.52,
        wear=0.52,
        grime=0.50,
        dust=0.18,
    ),
    SurfaceClass(
        name="Graphite",
        base_colour="#252d3d",
        metallic=0.18,
        roughness=0.44,
        panel_scale=16.0,
        panel_depth=0.60,
        wear=0.60,
        grime=0.56,
        dust=0.22,
    ),
    # No panel seams: this is ground, not a manufactured panel, so the seam grid
    # would read as tiling. Its relief comes from real scattered grit geometry.
    SurfaceClass(
        name="Basing",
        base_colour="#5c4a34",
        metallic=0.0,
        roughness=0.88,
        panel_scale=0.0,
        panel_depth=0.0,
        wear=0.18,
        grime=0.70,
        dust=1.35,
    ),
)

SURFACE_NAMES = tuple(surface.name for surface in SURFACE_CLASSES)

# Emissive accents stay out of the bake: their names and emission are the
# runtime's handle on ownership and status.
ACCENT_TOKENS = {
    "FactionAccent": "#0ea5e9",
    "Energy": "#f59e0b",
    "HazardAcid": "#84cc16",
    "ResourceOre": "#f97316",
    "Warning": "#f43f5e",
}

BAKE_TARGET_LABEL = "BAKE_TARGET"


def srgb_to_linear(channel: float) -> float:
    if channel <= 0.04045:
        return channel / 12.92
    return ((channel + 0.055) / 1.055) ** 2.4


def hex_to_linear(value: str) -> tuple[float, float, float, float]:
    text = value.lstrip("#")
    channels = [int(text[index : index + 2], 16) / 255 for index in (0, 2, 4)]
    return (*[srgb_to_linear(channel) for channel in channels], 1.0)


def _new(tree: bpy.types.NodeTree, kind: str, **inputs: float) -> bpy.types.Node:
    node = tree.nodes.new(kind)
    for key, value in inputs.items():
        node.inputs[key].default_value = value
    return node


def _ramp(
    tree: bpy.types.NodeTree, start: float, end: float, invert: bool = False
) -> bpy.types.Node:
    node = tree.nodes.new("ShaderNodeValToRGB")
    node.color_ramp.elements[0].position = start
    node.color_ramp.elements[1].position = end
    if invert:
        node.color_ramp.elements[0].color = (1, 1, 1, 1)
        node.color_ramp.elements[1].color = (0, 0, 0, 1)
    return node


def _mix_colour(
    tree: bpy.types.NodeTree, base: bpy.types.NodeSocket, target: tuple[float, float, float, float]
) -> bpy.types.Node:
    node = tree.nodes.new("ShaderNodeMix")
    node.data_type = "RGBA"
    node.inputs["B"].default_value = target
    tree.links.new(base, node.inputs["A"])
    return node


def _panel_seams(tree: bpy.types.NodeTree, coordinates: bpy.types.NodeSocket, scale: float) -> bpy.types.NodeSocket:
    """A 3D grid of thin seams, so every face of every part gets panel lines.

    Three axis-aligned band sets combined with `maximum`. One wave texture only
    lines up on faces facing across its own axis; on the others it smears into
    stripes running off the edge of the part.
    """
    masks: list[bpy.types.NodeSocket] = []
    for direction in ("X", "Y", "Z"):
        wave = tree.nodes.new("ShaderNodeTexWave")
        wave.wave_type = "BANDS"
        wave.bands_direction = direction
        wave.wave_profile = "TRI"
        wave.inputs["Scale"].default_value = scale
        wave.inputs["Distortion"].default_value = 0.0
        tree.links.new(coordinates, wave.inputs["Vector"])
        # A tight ramp near the band trough turns the triangle wave into a thin
        # score rather than a soft gradient.
        ramp = _ramp(tree, 0.0, 0.055, invert=True)
        tree.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
        masks.append(ramp.outputs["Color"])

    combined = masks[0]
    for mask in masks[1:]:
        maximum = tree.nodes.new("ShaderNodeMath")
        maximum.operation = "MAXIMUM"
        tree.links.new(combined, maximum.inputs[0])
        tree.links.new(mask, maximum.inputs[1])
        combined = maximum.outputs["Value"]
    return combined


def _create_surface_material(surface: SurfaceClass) -> bpy.types.Material:
    material = bpy.data.materials.new(surface.name)
    material.use_nodes = True
    tree = material.node_tree
    principled = tree.nodes["Principled BSDF"]

    base = hex_to_linear(surface.base_colour)
    coordinates = tree.nodes.new("ShaderNodeTexCoord")
    # Object coordinates rather than generated: generated normalises to the
    # bounding box, so the seam spacing would stretch differently on every part.
    object_coordinates = coordinates.outputs["Object"]

    geometry = tree.nodes.new("ShaderNodeNewGeometry")

    # --- panel seams -------------------------------------------------------
    # A zero scale means "not a manufactured panel" (the base plate's ground),
    # where a seam grid would read as tiling.
    seams = (
        _panel_seams(tree, object_coordinates, surface.panel_scale)
        if surface.panel_scale > 0
        else _constant_value(tree, 0.0)
    )

    # --- micro surface noise ----------------------------------------------
    micro = _new(tree, "ShaderNodeTexNoise", Scale=MICRO_NOISE_SCALE, Detail=6.0, Roughness=0.6)
    tree.links.new(object_coordinates, micro.inputs["Vector"])

    # Noise remapped to 0.5..1 rather than 0..1. Multiplying a mask by raw noise
    # halves its average, so effects had to be cranked up to compensate and then
    # blew past full strength on anything the noise happened to favour.
    breakup = tree.nodes.new("ShaderNodeMath")
    breakup.operation = "MULTIPLY_ADD"
    breakup.inputs[1].default_value = 0.5
    breakup.inputs[2].default_value = 0.5
    tree.links.new(micro.outputs["Fac"], breakup.inputs[0])

    # --- edge highlights: convex edges rub back toward bare metal -----------
    # Pointiness is 0.5 on a flat face and rises on convex ones. The bevels are
    # multi-segment, so this ramp has to start well above 0.5 or it catches the
    # whole chamfer and the piece turns uniformly bright — losing the three
    # separated values that make it read as hardware rather than bare metal.
    wear_ramp = _ramp(tree, 0.58, 0.74)
    tree.links.new(geometry.outputs["Pointiness"], wear_ramp.inputs["Fac"])
    wear_break = tree.nodes.new("ShaderNodeMath")
    wear_break.operation = "MULTIPLY"
    tree.links.new(wear_ramp.outputs["Color"], wear_break.inputs[0])
    tree.links.new(breakup.outputs["Value"], wear_break.inputs[1])
    wear_amount = tree.nodes.new("ShaderNodeMath")
    wear_amount.operation = "MULTIPLY"
    wear_amount.inputs[1].default_value = surface.wear
    tree.links.new(wear_break.outputs["Value"], wear_amount.inputs[0])

    # --- crevice grime: ambient occlusion darkens where parts meet ---------
    occlusion = tree.nodes.new("ShaderNodeAmbientOcclusion")
    occlusion.samples = 8
    occlusion.inputs["Distance"].default_value = 0.09
    grime_ramp = _ramp(tree, 0.25, 0.95, invert=True)
    tree.links.new(occlusion.outputs["Color"], grime_ramp.inputs["Fac"])
    grime_amount = tree.nodes.new("ShaderNodeMath")
    grime_amount.operation = "MULTIPLY"
    grime_amount.inputs[1].default_value = surface.grime
    tree.links.new(grime_ramp.outputs["Color"], grime_amount.inputs[0])

    # --- settled dust: upward faces catch the board's regolith -------------
    normal_z = tree.nodes.new("ShaderNodeSeparateXYZ")
    tree.links.new(geometry.outputs["Normal"], normal_z.inputs["Vector"])
    dust_ramp = _ramp(tree, 0.35, 0.95)
    tree.links.new(normal_z.outputs["Z"], dust_ramp.inputs["Fac"])
    dust_break = tree.nodes.new("ShaderNodeMath")
    dust_break.operation = "MULTIPLY"
    tree.links.new(dust_ramp.outputs["Color"], dust_break.inputs[0])
    tree.links.new(breakup.outputs["Value"], dust_break.inputs[1])
    dust_amount = tree.nodes.new("ShaderNodeMath")
    dust_amount.operation = "MULTIPLY"
    dust_amount.inputs[1].default_value = surface.dust
    tree.links.new(dust_break.outputs["Value"], dust_amount.inputs[0])

    # --- base colour stack -------------------------------------------------
    # Order matters: wear exposes metal, then grime dirties it, then dust
    # settles on top of everything. Dust last is why a filthy piece still reads
    # as the right colour from above.
    seam_dark = _mix_colour(tree, _constant_colour(tree, base), (0.01, 0.012, 0.018, 1.0))
    seam_scale = tree.nodes.new("ShaderNodeMath")
    seam_scale.operation = "MULTIPLY"
    seam_scale.inputs[1].default_value = surface.panel_depth
    tree.links.new(seams, seam_scale.inputs[0])
    tree.links.new(seam_scale.outputs["Value"], seam_dark.inputs["Factor"])

    worn = _mix_colour(tree, seam_dark.outputs["Result"], hex_to_linear(WORN_METAL_COLOUR))
    tree.links.new(wear_amount.outputs["Value"], worn.inputs["Factor"])

    dirty = _mix_colour(tree, worn.outputs["Result"], (0.012, 0.013, 0.016, 1.0))
    tree.links.new(grime_amount.outputs["Value"], dirty.inputs["Factor"])

    dusty = _mix_colour(tree, dirty.outputs["Result"], hex_to_linear(DUST_COLOUR))
    tree.links.new(dust_amount.outputs["Value"], dusty.inputs["Factor"])
    tree.links.new(dusty.outputs["Result"], principled.inputs["Base Color"])

    # --- roughness ---------------------------------------------------------
    # Worn edges polish up, dust and grime roughen. A single uniform roughness is
    # the other half of why the flat kit reads as plastic.
    roughness = tree.nodes.new("ShaderNodeMath")
    roughness.operation = "ADD"
    roughness.inputs[0].default_value = surface.roughness
    micro_rough = tree.nodes.new("ShaderNodeMath")
    micro_rough.operation = "MULTIPLY_ADD"
    micro_rough.inputs[1].default_value = 0.16
    micro_rough.inputs[2].default_value = -0.08
    tree.links.new(micro.outputs["Fac"], micro_rough.inputs[0])
    tree.links.new(micro_rough.outputs["Value"], roughness.inputs[1])

    rough_dust = tree.nodes.new("ShaderNodeMath")
    rough_dust.operation = "MULTIPLY_ADD"
    rough_dust.inputs[1].default_value = 0.3
    tree.links.new(dust_amount.outputs["Value"], rough_dust.inputs[0])
    tree.links.new(roughness.outputs["Value"], rough_dust.inputs[2])

    rough_wear = tree.nodes.new("ShaderNodeMath")
    rough_wear.operation = "MULTIPLY_ADD"
    rough_wear.inputs[1].default_value = -0.26
    tree.links.new(wear_amount.outputs["Value"], rough_wear.inputs[0])
    tree.links.new(rough_dust.outputs["Value"], rough_wear.inputs[2])

    clamp = tree.nodes.new("ShaderNodeClamp")
    clamp.inputs["Min"].default_value = 0.08
    clamp.inputs["Max"].default_value = 1.0
    tree.links.new(rough_wear.outputs["Value"], clamp.inputs["Value"])
    tree.links.new(clamp.outputs["Result"], principled.inputs["Roughness"])

    # --- surface relief ----------------------------------------------------
    # Seams cut in, micro noise gives the surface tooth. Both bake to the normal
    # map, which is what keeps the silhouette low-poly while the shading is not.
    relief = tree.nodes.new("ShaderNodeMath")
    relief.operation = "MULTIPLY_ADD"
    relief.inputs[1].default_value = -1.0
    tree.links.new(seams, relief.inputs[0])
    tree.links.new(micro.outputs["Fac"], relief.inputs[2])

    bump = tree.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.32
    bump.inputs["Distance"].default_value = 0.012
    tree.links.new(relief.outputs["Value"], bump.inputs["Height"])
    tree.links.new(bump.outputs["Normal"], principled.inputs["Normal"])

    principled.inputs["Metallic"].default_value = surface.metallic
    material.diffuse_color = base
    return material


def _constant_colour(tree: bpy.types.NodeTree, colour: tuple[float, float, float, float]) -> bpy.types.NodeSocket:
    node = tree.nodes.new("ShaderNodeRGB")
    node.outputs["Color"].default_value = colour
    return node.outputs["Color"]


def _constant_value(tree: bpy.types.NodeTree, value: float) -> bpy.types.NodeSocket:
    node = tree.nodes.new("ShaderNodeValue")
    node.outputs["Value"].default_value = value
    return node.outputs["Value"]


def create_surface_materials() -> dict[str, bpy.types.Material]:
    """The procedural materials, ready to bake. Keyed by surface class name."""
    return {surface.name: _create_surface_material(surface) for surface in SURFACE_CLASSES}


def create_accent_materials() -> dict[str, bpy.types.Material]:
    """Emissive accents, which never enter the bake so their names survive."""
    materials: dict[str, bpy.types.Material] = {}
    for name, token in ACCENT_TOKENS.items():
        colour = hex_to_linear(token)
        material = bpy.data.materials.new(name)
        material.diffuse_color = colour
        material.use_nodes = True
        principled = material.node_tree.nodes["Principled BSDF"]
        principled.inputs["Base Color"].default_value = colour
        principled.inputs["Metallic"].default_value = 0.0
        principled.inputs["Roughness"].default_value = 0.25
        # Low strength on purpose: the renderer's bloom pass does the glowing.
        principled.inputs["Emission Color"].default_value = colour
        principled.inputs["Emission Strength"].default_value = 0.22
        materials[name] = material
    return materials


def create_piece_materials() -> dict[str, bpy.types.Material]:
    """Surface classes and emissive accents in one dict, as piece builders expect.

    Builders address materials by surface-class name and never need to know which
    of them the bake will consume, so handing them one flat dict keeps that split
    an implementation detail of the pipeline.
    """
    return {**create_surface_materials(), **create_accent_materials()}


def smooth_by_angle(object: bpy.types.Object, angle: float = 0.6) -> None:
    """Shade smooth above an angle, so bevels round off but panel edges stay hard.

    This is what separates a moulded pressure shell from a faceted rock. Blender
    replaced the old per-mesh auto-smooth flag with an operator, so fall back to
    plain smooth shading if this build predates it.
    """
    bpy.context.view_layer.objects.active = object
    bpy.ops.object.select_all(action="DESELECT")
    object.select_set(True)
    if hasattr(bpy.ops.object, "shade_smooth_by_angle"):
        bpy.ops.object.shade_smooth_by_angle(angle=angle)
    else:
        bpy.ops.object.shade_smooth()


def _select(objects: list[bpy.types.Object]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for object in objects:
        object.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def join_by_surface(objects: list[bpy.types.Object]) -> dict[str, bpy.types.Object]:
    """Join every part into one mesh per material.

    Two payoffs beyond tidiness: the atlas has a handful of islands to pack
    instead of one set per greeble, and the runtime draws a few meshes per piece
    rather than sixty.
    """
    groups: dict[str, list[bpy.types.Object]] = {}
    for object in objects:
        if object.type != "MESH" or not object.data.materials:
            continue
        groups.setdefault(object.data.materials[0].name, []).append(object)

    joined: dict[str, bpy.types.Object] = {}
    for name, group in groups.items():
        _select(group)
        if len(group) > 1:
            bpy.ops.object.join()
        result = bpy.context.view_layer.objects.active
        result.name = f"Android {name}"
        joined[name] = result
    return joined


def unwrap_atlas(objects: list[bpy.types.Object], margin: float = 0.012) -> None:
    """Unwrap each mesh, then pack every island into one shared 0-1 space."""
    for object in objects:
        _select([object])
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=margin)
        bpy.ops.object.mode_set(mode="OBJECT")

    _select(objects)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.pack_islands(margin=margin)
    bpy.ops.object.mode_set(mode="OBJECT")


# Base colour is baked as DIFFUSE with lighting passes off, which yields the raw
# albedo. NORMAL captures the procedural bump. ROUGHNESS captures the wear and
# dust response. Metallic has no bake type and stays a per-class factor.
#
# Resolution is per map, because a uniform 1024² for all three cost 2.7 MB per
# piece — around 30 MB across the set, which is not a thing you download to play
# a browser game. Base colour carries the detail the eye reads and stays full
# size; roughness and normal are lower frequency and halve cleanly.
#
# `file_format` here only governs the inspection copies written by `--dump-maps`;
# the GLB itself is written as WebP by the exporter, which `EXT_texture_webp`
# makes safe for the three.js `GLTFLoader` the renderer already uses.
_BAKE_MAPS = (
    ("basecolor", "DIFFUSE", False, 1.0, "JPEG"),
    ("roughness", "ROUGHNESS", True, 0.5, "JPEG"),
    ("normal", "NORMAL", True, 0.5, "PNG"),
)


def bake_surface_atlas(
    objects: list[bpy.types.Object],
    piece_name: str,
    size: int = 1024,
    samples: int = 24,
) -> dict[str, bpy.types.Image]:
    unwrap_atlas(objects)

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    scene.render.bake.use_selected_to_active = False
    scene.render.bake.margin = 8
    scene.render.bake.use_clear = True

    images: dict[str, bpy.types.Image] = {}
    for map_name, bake_type, non_colour, scale, file_format in _BAKE_MAPS:
        resolution = max(64, int(size * scale))
        image = bpy.data.images.new(f"{piece_name}-{map_name}", resolution, resolution, alpha=False)
        if non_colour:
            image.colorspace_settings.name = "Non-Color"
        # The glTF exporter's AUTO format writes PNGs as PNGs and JPEGs as JPEGs,
        # so the per-map choice is carried on the image itself.
        image.file_format = file_format
        images[map_name] = image

        for object in objects:
            for material in object.data.materials:
                tree = material.node_tree
                node = next(
                    (n for n in tree.nodes if n.bl_idname == "ShaderNodeTexImage" and n.label == BAKE_TARGET_LABEL),
                    None,
                )
                if node is None:
                    node = tree.nodes.new("ShaderNodeTexImage")
                    node.label = BAKE_TARGET_LABEL
                node.image = image
                tree.nodes.active = node

        if bake_type == "DIFFUSE":
            scene.render.bake.use_pass_direct = False
            scene.render.bake.use_pass_indirect = False
            scene.render.bake.use_pass_color = True

        _select(objects)
        bpy.ops.object.bake(type=bake_type)
    return images


def apply_baked_surfaces(
    joined: dict[str, bpy.types.Object], images: dict[str, bpy.types.Image]
) -> dict[str, bpy.types.Material]:
    """Swap each procedural material for one sampling the baked atlas.

    Roughness comes entirely from the map, so `roughnessFactor` is left at 1 and
    only metallic stays per class.
    """
    by_name = {surface.name: surface for surface in SURFACE_CLASSES}
    materials: dict[str, bpy.types.Material] = {}

    for name, object in joined.items():
        surface = by_name.get(name)
        if surface is None:
            continue
        # The procedural material has to surrender its name before the baked one
        # can claim it, or Blender silently hands back `Graphite.001` and the GLB
        # ships surface classes nothing downstream can recognise.
        #
        # Renaming rather than deleting, because deleting is not reliable here:
        # joining N objects leaves orphaned mesh datablocks that still reference
        # the material, so its user count never reaches zero and a
        # delete-if-unused guard silently does nothing. Ceramic was the only class
        # that came out clean — because it is a single part, so no join happened.
        for old in list(object.data.materials):
            old.name = f"{name}-procedural"
        material = bpy.data.materials.new(name)
        material.use_nodes = True
        tree = material.node_tree
        principled = tree.nodes["Principled BSDF"]

        base_node = tree.nodes.new("ShaderNodeTexImage")
        base_node.image = images["basecolor"]
        tree.links.new(base_node.outputs["Color"], principled.inputs["Base Color"])

        rough_node = tree.nodes.new("ShaderNodeTexImage")
        rough_node.image = images["roughness"]
        tree.links.new(rough_node.outputs["Color"], principled.inputs["Roughness"])

        normal_node = tree.nodes.new("ShaderNodeTexImage")
        normal_node.image = images["normal"]
        normal_map = tree.nodes.new("ShaderNodeNormalMap")
        tree.links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
        tree.links.new(normal_map.outputs["Normal"], principled.inputs["Normal"])

        principled.inputs["Metallic"].default_value = surface.metallic

        object.data.materials.clear()
        object.data.materials.append(material)
        materials[name] = material
    return materials
