"""Shared primitives, materials, and family motifs for Project Nova's pieces.

Kept separate from the piece builders so the design language lives in one place:
every piece is assembled from these helpers, which is what makes the set read as
a family rather than ten unrelated models.
"""

from __future__ import annotations

from math import cos, pi, sin

import bpy

# Authored as sRGB hex so these stay eyeball-comparable with the tokens in
# packages/renderer/src/nova-palette.ts. Keep the two in step.
MATERIAL_TOKENS = {
    # Three clearly separated values: graphite mass, slate machinery, ceramic hull.
    # Slate sits well below ceramic on purpose — when they were close the pieces
    # read as uniformly white plastic instead of hardware.
    "StructureDark": "#252d3d",
    "StructureLight": "#66788f",
    "Ceramic": "#e6dece",
    "FactionAccent": "#0ea5e9",
    "Energy": "#f59e0b",
    "HazardAcid": "#84cc16",
    "ResourceOre": "#f97316",
    "Warning": "#f43f5e",
}

EMISSIVE_MATERIALS = {"FactionAccent", "Energy", "HazardAcid", "ResourceOre", "Warning"}

# The plinth is the widest thing at ground level on every built piece; nothing
# may overhang it, which is what keeps pieces sitting inside their tile.
PLINTH_RADIUS = 0.41


def srgb_to_linear(channel: float) -> float:
    if channel <= 0.04045:
        return channel / 12.92
    return ((channel + 0.055) / 1.055) ** 2.4


def hex_to_linear(value: str) -> tuple[float, float, float, float]:
    text = value.lstrip("#")
    channels = [int(text[index : index + 2], 16) / 255 for index in (0, 2, 4)]
    return (*[srgb_to_linear(channel) for channel in channels], 1.0)


def create_materials() -> dict[str, bpy.types.Material]:
    materials: dict[str, bpy.types.Material] = {}
    for name, token in MATERIAL_TOKENS.items():
        colour = hex_to_linear(token)
        material = bpy.data.materials.new(name)
        material.diffuse_color = colour
        material.use_nodes = True
        principled = material.node_tree.nodes.get("Principled BSDF")
        principled.inputs["Base Color"].default_value = colour
        if name == "Ceramic":
            principled.inputs["Metallic"].default_value = 0.0
            principled.inputs["Roughness"].default_value = 0.55
        elif name.startswith("Structure"):
            principled.inputs["Metallic"].default_value = 0.72
            principled.inputs["Roughness"].default_value = 0.38
        else:
            principled.inputs["Metallic"].default_value = 0.1
            principled.inputs["Roughness"].default_value = 0.3
        if name in EMISSIVE_MATERIALS:
            # Low strength on purpose: the renderer's bloom pass does the glowing.
            # Anything higher washes the accent out to a pale tint in-engine.
            principled.inputs["Emission Color"].default_value = colour
            principled.inputs["Emission Strength"].default_value = 0.22
        materials[name] = material
    return materials


def _finish(name: str, material: bpy.types.Material) -> bpy.types.Object:
    """Name, assign, and flat-shade the freshly created object."""
    object = bpy.context.object
    object.name = name
    object.data.materials.append(material)
    bpy.ops.object.shade_flat()
    return object


def _bevel(object: bpy.types.Object, width: float, segments: int = 1) -> None:
    if not width:
        return
    modifier = object.modifiers.new("Chamfer", "BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "ANGLE"
    modifier.angle_limit = pi / 4
    bpy.context.view_layer.objects.active = object
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def add_box(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    bevel: float = 0.03,
    rotation: tuple[float, float, float] = (0, 0, 0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    object = bpy.context.object
    object.scale = tuple(value / 2 for value in scale)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    _bevel(object, bevel)
    return _finish(name, material)


def add_cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    material: bpy.types.Material,
    vertices: int = 12,
    rotation: tuple[float, float, float] = (0, 0, 0),
    bevel: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation
    )
    object = bpy.context.object
    _bevel(object, bevel)
    return _finish(name, material)


def add_cone(
    name: str,
    location: tuple[float, float, float],
    radius_1: float,
    radius_2: float,
    depth: float,
    material: bpy.types.Material,
    rotation: tuple[float, float, float] = (0, 0, 0),
    vertices: int = 12,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius_1,
        radius2=radius_2,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    return _finish(name, material)


def add_facet_dome(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    material: bpy.types.Material,
    flatten: float = 0.66,
    subdivisions: int = 2,
) -> bpy.types.Object:
    """A geodesic dome. Icospheres facet cleanly; UV spheres read as lumpy balls."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=radius, location=location)
    object = bpy.context.object
    object.scale = (1, 1, flatten)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _finish(name, material)


def add_torus(
    name: str,
    location: tuple[float, float, float],
    major_radius: float,
    minor_radius: float,
    material: bpy.types.Material,
    rotation: tuple[float, float, float] = (0, 0, 0),
    major_segments: int = 14,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=major_segments,
        minor_segments=4,
        location=location,
        rotation=rotation,
    )
    return _finish(name, material)


def add_plinth(materials: dict[str, bpy.types.Material], radius: float = PLINTH_RADIUS) -> None:
    """The double-tier graphite plinth every built piece stands on.

    The faction inlay runs along the piece's front (-Y) edge so ownership is
    readable from directly above, where hull accents are hidden.
    """
    # Deck top stays at ~0.137 — every piece's hull coordinates are measured from
    # it, so this height is load-bearing. Weight is reduced via footprint and the
    # slate deck breaking up the graphite, not by lowering the stack.
    add_cylinder("Plinth lower tier", (0, 0, 0.028), radius, 0.056, materials["StructureDark"], vertices=12)
    add_cylinder("Plinth upper tier", (0, 0, 0.088), radius * 0.86, 0.064, materials["StructureDark"], vertices=12)
    add_cylinder(
        "Plinth deck", (0, 0, 0.128), radius * 0.74, 0.018, materials["StructureLight"], vertices=12, bevel=0.007
    )
    add_box(
        "Faction inlay",
        (0, -radius * 0.76, 0.095),
        (radius * 0.6, 0.032, 0.03),
        materials["FactionAccent"],
        bevel=0.006,
    )


def add_collar(
    materials: dict[str, bpy.types.Material],
    location: tuple[float, float, float],
    radius: float,
) -> None:
    """The joint detail where a hull meets its plinth. Repeated on every piece."""
    add_torus("Hull collar", location, radius, 0.016, materials["StructureLight"], major_segments=12)


def add_chevrons(
    materials: dict[str, bpy.types.Material],
    location: tuple[float, float, float],
    width: float,
    count: int = 3,
) -> None:
    """Striped hazard marker. Reserved for hazard and construction pieces."""
    step = width / count
    for index in range(count):
        add_box(
            "Warning chevron",
            (location[0] - width / 2 + step * (index + 0.5), location[1], location[2]),
            (step * 0.44, 0.016, 0.09),
            materials["Warning"],
            bevel=0.003,
            rotation=(0, 0.6, 0),
        )


def add_lattice_mast(
    materials: dict[str, bpy.types.Material],
    base_z: float,
    height: float,
    spread: float = 0.075,
) -> None:
    """An open braced mast. Far more interesting in silhouette than a bare tube."""
    for angle in (pi / 4, 3 * pi / 4, 5 * pi / 4, 7 * pi / 4):
        add_box(
            "Mast leg",
            (cos(angle) * spread, sin(angle) * spread, base_z + height / 2),
            (0.028, 0.028, height),
            materials["StructureDark"],
            bevel=0.006,
        )
    braces = 3
    for index in range(braces):
        z = base_z + height * (index + 0.5) / braces
        for rotation in (0.0, pi / 2):
            add_box(
                "Mast brace",
                (0, 0, z),
                (spread * 2.1, 0.02, 0.02),
                materials["StructureLight"],
                bevel=0.004,
                rotation=(0, 0, rotation),
            )
