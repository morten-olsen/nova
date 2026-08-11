"""Shared primitives and family motifs for Project Nova's pieces.

Kept separate from the piece builders so the design language lives in one place:
every piece is assembled from these helpers, which is what makes the set read as
a family rather than eleven unrelated models.

Materials are *not* here — they live in `nova_surfaces.py`, which owns the surface
classes and the bake that turns them into textures glTF can carry. This module
knows only about shapes, and takes whatever material it is handed.

Helpers take materials by surface-class name: `Graphite` for structural mass,
`Chassis` for machinery, `Ceramic` for pressure hulls, `Basing` for the base
plate's ground, plus the emissive accents.
"""

from __future__ import annotations

import random
from math import cos, pi, sin

import bpy

# The base plate is the widest thing at ground level on every built piece; nothing
# may overhang it, which is what keeps pieces inside their tile when the renderer
# packs several onto one.
BASE_RADIUS = 0.41

# Top of the base plate's recessed ground. Every piece's geometry is measured from
# it, so pieces stand on their base rather than hovering over it.
GROUND_TOP = 0.070


def _finish(name: str, material: bpy.types.Material, smooth: float | None = None) -> bpy.types.Object:
    """Name, assign, and shade the freshly created object.

    `smooth` is an angle in radians: above it, faces shade smooth. That is what
    separates a moulded pressure shell from a faceted rock, so it is per-call
    rather than a global choice.
    """
    object = bpy.context.object
    object.name = name
    object.data.materials.append(material)
    if smooth is None:
        bpy.ops.object.shade_flat()
    else:
        smooth_by_angle(object, smooth)
    return object


def smooth_by_angle(object: bpy.types.Object, angle: float = 0.55) -> None:
    """Shade smooth above an angle, so chamfers round off but panel edges stay hard.

    Blender replaced the old per-mesh auto-smooth flag with an operator, so fall
    back to plain smooth shading if this build predates it.
    """
    bpy.context.view_layer.objects.active = object
    bpy.ops.object.select_all(action="DESELECT")
    object.select_set(True)
    if hasattr(bpy.ops.object, "shade_smooth_by_angle"):
        bpy.ops.object.shade_smooth_by_angle(angle=angle)
    else:
        bpy.ops.object.shade_smooth()


def _bevel(object: bpy.types.Object, width: float, segments: int = 2) -> None:
    if not width:
        return
    modifier = object.modifiers.new("Chamfer", "BEVEL")
    modifier.width = width
    # Two segments by default. A single-segment bevel is a hard 45° cut, which is
    # most of why the first iteration of this set read as faceted plastic.
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
    segments: int = 2,
    smooth: float | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    object = bpy.context.object
    object.scale = tuple(value / 2 for value in scale)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    _bevel(object, bevel, segments)
    return _finish(name, material, smooth)


def add_rounded_box(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    bevel: float = 0.022,
    segments: int = 3,
    rotation: tuple[float, float, float] = (0, 0, 0),
    smooth: float | None = 0.55,
) -> bpy.types.Object:
    """A box with a generous multi-segment chamfer, smooth-shaded by default.

    The workhorse for hull and machinery forms: reads as a moulded, tooled shell
    rather than a chamfered cube.
    """
    return add_box(name, location, scale, material, bevel, rotation, segments, smooth)


def add_cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    material: bpy.types.Material,
    vertices: int = 12,
    rotation: tuple[float, float, float] = (0, 0, 0),
    bevel: float = 0.0,
    smooth: float | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation
    )
    object = bpy.context.object
    _bevel(object, bevel)
    return _finish(name, material, smooth)


def add_cone(
    name: str,
    location: tuple[float, float, float],
    radius_1: float,
    radius_2: float,
    depth: float,
    material: bpy.types.Material,
    rotation: tuple[float, float, float] = (0, 0, 0),
    vertices: int = 12,
    smooth: float | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius_1,
        radius2=radius_2,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    return _finish(name, material, smooth)


def add_sphere(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    material: bpy.types.Material,
    subdivisions: int = 2,
    scale: tuple[float, float, float] = (1, 1, 1),
    smooth: float | None = 0.9,
) -> bpy.types.Object:
    """A joint or a boulder. Spheres at the joints make limbs read as articulated."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=radius, location=location)
    object = bpy.context.object
    object.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _finish(name, material, smooth)


def add_facet_dome(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    material: bpy.types.Material,
    flatten: float = 0.66,
    subdivisions: int = 2,
    smooth: float | None = None,
) -> bpy.types.Object:
    """A geodesic dome. Icospheres facet cleanly; UV spheres read as lumpy balls."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=radius, location=location)
    object = bpy.context.object
    object.scale = (1, 1, flatten)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _finish(name, material, smooth)


def add_torus(
    name: str,
    location: tuple[float, float, float],
    major_radius: float,
    minor_radius: float,
    material: bpy.types.Material,
    rotation: tuple[float, float, float] = (0, 0, 0),
    major_segments: int = 14,
    smooth: float | None = 0.9,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=major_segments,
        minor_segments=6,
        location=location,
        rotation=rotation,
    )
    return _finish(name, material, smooth)


def add_base_plate(
    materials: dict[str, bpy.types.Material],
    radius: float = BASE_RADIUS,
    shape: str = "round",
    seed: int = 11,
) -> None:
    """The display base every built piece stands on.

    A chamfered rim, a recessed gritty top, a faction inlay along the front edge,
    and a designation plate. The grit is real geometry rather than texture: the
    basing surface deliberately carries no panel seams, so this is its only relief,
    and a textured base is much of what separates a display miniature from a toy.

    A hex base is rotated so a flat edge faces front — a vertex pointing at the
    camera reads as a piece sitting crooked on a square grid.
    """
    sides = 6 if shape == "hex" else 24
    turn = pi / 6 if shape == "hex" else 0.0

    add_cylinder(
        "Base rim", (0, 0, 0.030), radius, 0.060, materials["Graphite"], vertices=sides, bevel=0.012,
        rotation=(0, 0, turn),
    )
    add_cylinder(
        "Base lip", (0, 0, 0.068), radius * 0.985, 0.020, materials["Chassis"], vertices=sides, bevel=0.007,
        rotation=(0, 0, turn),
    )
    # Sits below the lip's top edge so the rim reads as a frame containing ground.
    add_cylinder(
        "Base ground", (0, 0, 0.055), radius * 0.90, 0.030, materials["Basing"], vertices=sides,
        rotation=(0, 0, turn),
    )

    scatter = random.Random(seed)
    for _ in range(26):
        angle = scatter.uniform(0, 2 * pi)
        distance = radius * 0.88 * (scatter.uniform(0.15, 1.0) ** 0.5)
        size = scatter.uniform(0.012, 0.032)
        add_sphere(
            "Base grit",
            (cos(angle) * distance, sin(angle) * distance, GROUND_TOP - size * 0.35),
            size,
            materials["Basing"],
            subdivisions=1,
            scale=(1.0, scatter.uniform(0.7, 1.3), scatter.uniform(0.35, 0.6)),
            smooth=None,
        )
    for _ in range(3):
        angle = scatter.uniform(0, 2 * pi)
        add_sphere(
            "Base rock",
            (cos(angle) * radius * 0.72, sin(angle) * radius * 0.72, GROUND_TOP - 0.010),
            scatter.uniform(0.038, 0.052),
            materials["Graphite"],
            subdivisions=1,
            scale=(1.0, scatter.uniform(0.8, 1.2), 0.55),
            smooth=None,
        )

    # Faction inlay along the front edge, readable from directly overhead where
    # hull accents are hidden.
    add_box(
        "Faction inlay",
        (0, -radius * 0.925, 0.070),
        (radius * 0.62, 0.030, 0.024),
        materials["FactionAccent"],
        bevel=0.005,
    )
    # A manufactured piece has a part number on it.
    add_box(
        "Designation plate",
        (radius * 0.52, radius * 0.66, 0.070),
        (0.12, 0.055, 0.018),
        materials["Chassis"],
        bevel=0.006,
    )


def add_collar(
    materials: dict[str, bpy.types.Material],
    location: tuple[float, float, float],
    radius: float,
) -> None:
    """The joint detail where a hull meets its base. Repeated on every piece."""
    add_torus("Hull collar", location, radius, 0.016, materials["Chassis"], major_segments=16)


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
            materials["Graphite"],
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
                materials["Chassis"],
                bevel=0.004,
                rotation=(0, 0, rotation),
            )
