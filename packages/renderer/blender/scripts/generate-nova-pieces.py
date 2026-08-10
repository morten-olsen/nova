"""Generate Project Nova's low-poly frontier sci-fi tabletop pieces.

Run from the repository root:
  blender --background --python packages/renderer/blender/scripts/generate-nova-pieces.py

Pass arguments after `--` to limit the export or change its location:
  blender --background --python ... -- --only android charger --output-dir /tmp/nova-models

Render every piece side by side to judge the set as a family:
  blender --background --python ... -- --contact-sheet

The script saves one editable source blend, a PNG review render, and one GLB per
piece. Shared materials and family motifs live in nova_kit.py.
"""

from __future__ import annotations

import argparse
import sys
from math import cos, pi, sin
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))

from nova_kit import (  # noqa: E402
    PLINTH_RADIUS,
    add_box,
    add_chevrons,
    add_collar,
    add_cone,
    add_cylinder,
    add_facet_dome,
    add_lattice_mast,
    add_plinth,
    add_torus,
    create_materials,
)

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT_DIR = ROOT / "assets" / "models"
DEFAULT_PREVIEW_DIR = ROOT / "assets" / "previews"
DEFAULT_SOURCE_DIR = ROOT / "blender" / "source"

Materials = dict[str, bpy.types.Material]


def build_android(materials: Materials) -> None:
    """Compact two-legged worker. Forward lean and a wide visor give it a front."""
    add_plinth(materials, 0.3)
    # Wide stance on purpose: with a narrower one the legs hid inside the torso
    # silhouette and the two-legged read was lost at replay distance.
    for side in (-1, 1):
        add_box(
            "Articulated leg",
            (side * 0.21, 0.01, 0.28),
            (0.11, 0.14, 0.3),
            materials["StructureDark"],
            rotation=(0, side * -0.2, 0),
        )
        add_box("Knee actuator", (side * 0.25, 0.01, 0.33), (0.13, 0.09, 0.08), materials["StructureLight"], 0.014)
        add_box("Clawed foot", (side * 0.26, -0.03, 0.17), (0.16, 0.2, 0.06), materials["StructureLight"], 0.014)
    add_collar(materials, (0, 0, 0.16), 0.23)
    add_cone("Armoured torso", (0, 0.01, 0.47), 0.23, 0.17, 0.3, materials["Ceramic"])
    add_box("Chest plate", (0, -0.17, 0.47), (0.2, 0.05, 0.16), materials["StructureLight"], 0.02)
    add_box("Rear power pack", (0, 0.2, 0.45), (0.28, 0.15, 0.25), materials["StructureDark"])
    add_box("Power cells", (0, 0.285, 0.47), (0.17, 0.03, 0.09), materials["Energy"], 0.006)
    add_box("Shoulder yoke", (0, 0.02, 0.63), (0.36, 0.16, 0.06), materials["StructureDark"], 0.018)
    add_facet_dome("Sensor head", (0, -0.03, 0.68), 0.15, materials["StructureDark"], flatten=0.8, subdivisions=1)
    add_box("Optical visor", (0, -0.14, 0.69), (0.2, 0.05, 0.06), materials["FactionAccent"], 0.014)
    add_cylinder("Antenna", (0.11, 0.11, 0.79), 0.012, 0.18, materials["StructureLight"], vertices=6)
    add_facet_dome("Antenna tip", (0.11, 0.11, 0.89), 0.028, materials["FactionAccent"], flatten=1.0, subdivisions=1)


def build_charger(materials: Materials) -> None:
    """U-shaped gantry over a circular pad. Reads as a gate from any angle."""
    add_plinth(materials)
    add_cylinder("Induction pad", (0, -0.05, 0.16), 0.26, 0.06, materials["StructureDark"], bevel=0.012)
    add_torus("Charging ring", (0, -0.05, 0.2), 0.19, 0.028, materials["Energy"])
    add_facet_dome("Pad emitter", (0, -0.05, 0.2), 0.07, materials["Energy"], flatten=0.5, subdivisions=1)
    for side in (-1, 1):
        add_box("Gantry upright", (side * 0.29, 0.06, 0.44), (0.11, 0.15, 0.62), materials["Ceramic"])
        add_box("Upright conduit", (side * 0.29, -0.04, 0.44), (0.05, 0.05, 0.5), materials["FactionAccent"], 0.01)
    add_box("Gantry crossbeam", (0, 0.06, 0.78), (0.69, 0.14, 0.11), materials["Ceramic"])
    add_box("Crossbeam emitter", (0, -0.02, 0.71), (0.3, 0.06, 0.06), materials["Energy"], 0.012)
    add_cylinder("Reactor drum", (0, 0.27, 0.34), 0.12, 0.4, materials["StructureDark"], bevel=0.02)
    add_cylinder("Reactor core", (0, 0.27, 0.36), 0.07, 0.42, materials["FactionAccent"])
    add_torus("Reactor collar", (0, 0.27, 0.52), 0.12, 0.022, materials["StructureLight"], major_segments=12)


def build_depot(materials: Materials) -> None:
    """Asymmetric stack of sealed crates. Deliberately the most mundane silhouette."""
    add_plinth(materials)
    add_box("Depot deck", (0, 0.02, 0.18), (0.72, 0.62, 0.08), materials["StructureDark"], 0.02)
    add_box("Primary cargo pod", (-0.15, 0.05, 0.37), (0.4, 0.46, 0.31), materials["Ceramic"])
    add_box("Pod faction panel", (-0.15, -0.19, 0.38), (0.26, 0.03, 0.14), materials["FactionAccent"], 0.008)
    add_box("Stacked pod", (-0.15, 0.09, 0.6), (0.3, 0.34, 0.16), materials["StructureLight"], 0.024)
    add_box("Utility crate", (0.25, 0.14, 0.33), (0.24, 0.32, 0.23), materials["StructureDark"])
    add_box("Sample tray", (0.25, -0.16, 0.26), (0.22, 0.2, 0.08), materials["StructureLight"], 0.016)
    for offset in (-0.28, 0.02):
        add_box("Cargo clamp", (offset, -0.28, 0.2), (0.07, 0.06, 0.12), materials["Energy"], 0.008)
    add_cylinder("Inventory mast", (0.29, 0.24, 0.58), 0.028, 0.34, materials["StructureDark"], vertices=6)
    add_facet_dome("Inventory beacon", (0.29, 0.24, 0.77), 0.055, materials["FactionAccent"], flatten=1.0, subdivisions=1)


def build_extractor(materials: Materials) -> None:
    """Drill derrick. Four converging legs give it a unique triangular read."""
    add_plinth(materials)
    for x, y in ((-0.26, -0.24), (0.26, -0.24), (-0.26, 0.24), (0.26, 0.24)):
        add_box(
            "Derrick leg",
            (x * 0.62, y * 0.62, 0.44),
            (0.07, 0.07, 0.74),
            materials["StructureDark"],
            bevel=0.012,
            rotation=(y * 0.5, -x * 0.5, 0),
        )
    add_box("Derrick collar", (0, 0, 0.5), (0.34, 0.34, 0.05), materials["StructureLight"], 0.014)
    add_torus("Drill warning ring", (0, 0, 0.22), 0.22, 0.03, materials["ResourceOre"])
    add_cylinder("Drill housing", (0, 0, 0.3), 0.15, 0.32, materials["Ceramic"], bevel=0.02)
    add_cone("Ore drill", (0, 0, 0.68), 0.11, 0.03, 0.42, materials["StructureDark"])
    add_facet_dome("Derrick crown", (0, 0, 0.86), 0.1, materials["StructureLight"], flatten=0.5, subdivisions=1)
    add_cylinder("Ore hopper", (0.28, 0.24, 0.3), 0.13, 0.36, materials["StructureDark"], bevel=0.02)
    add_box("Ore chute", (0.28, -0.04, 0.26), (0.13, 0.34, 0.1), materials["ResourceOre"], 0.012)


def build_processor(materials: Materials) -> None:
    """Squared plant with twin stacks. The tallest standard building."""
    add_plinth(materials)
    add_box("Furnace housing", (0.16, 0.02, 0.34), (0.44, 0.52, 0.4), materials["StructureDark"])
    add_collar(materials, (-0.19, 0.02, 0.16), 0.21)
    add_cylinder("Pressure vessel", (-0.19, 0.02, 0.42), 0.2, 0.54, materials["Ceramic"], bevel=0.03)
    add_torus("Vessel heat band", (-0.19, 0.02, 0.34), 0.2, 0.026, materials["Energy"])
    add_box("Molten output", (0.16, -0.25, 0.34), (0.24, 0.03, 0.15), materials["Energy"], 0.008)
    for x in (0.03, 0.29):
        add_cylinder("Refinery stack", (x, 0.16, 0.74), 0.062, 0.42, materials["StructureDark"], vertices=8)
        add_cone("Stack crown", (x, 0.16, 0.98), 0.088, 0.055, 0.08, materials["StructureLight"], vertices=8)
    add_cylinder("Ore inlet", (-0.19, -0.3, 0.26), 0.075, 0.22, materials["ResourceOre"], rotation=(pi / 2, 0, 0))


def build_acid_processing_plant(materials: Materials) -> None:
    """Contained tank with external pipework, chevron-marked as a hazard system."""
    add_plinth(materials)
    add_collar(materials, (-0.13, 0.03, 0.16), 0.23)
    add_cylinder("Containment tank", (-0.13, 0.03, 0.44), 0.22, 0.58, materials["StructureLight"], bevel=0.03)
    add_box("Acid sight glass", (-0.13, -0.22, 0.44), (0.09, 0.04, 0.3), materials["HazardAcid"], 0.012)
    add_torus("Containment collar", (-0.13, 0.03, 0.7), 0.22, 0.026, materials["Ceramic"])
    add_facet_dome("Scrubber cap", (-0.13, 0.03, 0.74), 0.19, materials["Ceramic"], flatten=0.5)
    add_box("Neutralisation rig", (0.26, 0.06, 0.32), (0.3, 0.42, 0.36), materials["StructureDark"])
    add_box("Acid monitor", (0.26, -0.16, 0.36), (0.16, 0.03, 0.14), materials["HazardAcid"], 0.008)
    add_cylinder("Transfer canister", (0.28, 0.22, 0.62), 0.06, 0.28, materials["HazardAcid"], vertices=8)
    for z in (0.3, 0.5):
        add_torus("Tank pipe", (-0.13, 0.03, z), 0.26, 0.022, materials["StructureDark"], major_segments=12)
    add_chevrons(materials, (0.26, -0.27, 0.19), 0.24)


def build_relay_tower(materials: Materials) -> None:
    """Thin braced mast with an offset dish. The narrowest, tallest silhouette."""
    add_plinth(materials, 0.32)
    add_lattice_mast(materials, 0.13, 0.82, spread=0.085)
    add_box("Mast platform", (0, 0, 0.96), (0.3, 0.3, 0.045), materials["StructureLight"], 0.012)
    add_box("Dish arm", (0, -0.16, 0.78), (0.055, 0.3, 0.055), materials["StructureDark"], 0.01)
    add_cone("Directional dish", (0, -0.31, 0.78), 0.3, 0.07, 0.18, materials["Ceramic"], rotation=(pi / 2, 0, 0))
    add_torus("Dish signal ring", (0, -0.39, 0.78), 0.21, 0.024, materials["FactionAccent"], rotation=(pi / 2, 0, 0))
    add_facet_dome("Dish feed", (0, -0.4, 0.78), 0.055, materials["FactionAccent"], flatten=1.0, subdivisions=1)
    add_cylinder("Beacon spire", (0, 0.05, 1.06), 0.022, 0.16, materials["StructureDark"], vertices=6)
    add_facet_dome("Relay beacon", (0, 0.05, 1.16), 0.055, materials["FactionAccent"], flatten=1.0, subdivisions=1)


def build_scanner(materials: Materials) -> None:
    """Low pedestal dominated by a wide tilted dish."""
    add_plinth(materials)
    add_collar(materials, (0, 0.06, 0.16), 0.19)
    add_cone("Scanner pedestal", (0, 0.06, 0.3), 0.19, 0.13, 0.3, materials["Ceramic"])
    add_cylinder("Dish pivot", (0, 0.02, 0.47), 0.09, 0.22, materials["StructureDark"], rotation=(0, pi / 2, 0))
    add_cone(
        "Wide sensor dish", (0, -0.09, 0.6), 0.38, 0.09, 0.16, materials["StructureLight"], rotation=(1.15, 0, 0)
    )
    add_torus(
        "Scan ring", (0, -0.15, 0.66), 0.27, 0.022, materials["FactionAccent"], rotation=(1.15, 0, 0), major_segments=16
    )
    add_facet_dome("Scan emitter", (0, -0.13, 0.64), 0.07, materials["FactionAccent"], flatten=0.6, subdivisions=1)
    add_cylinder("Uplink antenna", (0.2, 0.2, 0.52), 0.018, 0.4, materials["StructureDark"], vertices=6)
    add_facet_dome("Antenna tip", (0.2, 0.2, 0.73), 0.032, materials["Energy"], flatten=1.0, subdivisions=1)


# The array slab is tilted back so the three-quarter camera sees its face. Flat
# upright it collapsed to a thin line at replay distance and lost the piece.
RADAR_TILT = 0.42


def _on_array(
    centre: tuple[float, float, float],
    forward: float = 0.0,
    up: float = 0.0,
    lateral: float = 0.0,
) -> tuple[float, float, float]:
    """Position a detail relative to the tilted array's own face, not the world."""
    return (
        centre[0] + lateral,
        centre[1] - forward * cos(RADAR_TILT) + up * sin(RADAR_TILT),
        centre[2] + forward * sin(RADAR_TILT) + up * cos(RADAR_TILT),
    )


def build_radar(materials: Materials) -> None:
    """Wide flat planar array on a squat rotator turret.

    The scanner's dish and the relay tower's mast are both round, so the third
    sensor piece is deliberately rectangular: a broad flat slab is the only
    silhouette in the set that cannot be confused with either of them.
    """
    add_plinth(materials)
    add_collar(materials, (0, 0, 0.16), 0.26)
    add_cylinder("Turret base", (0, 0, 0.25), 0.26, 0.2, materials["Ceramic"], bevel=0.02)
    add_torus("Rotation race", (0, 0, 0.34), 0.26, 0.026, materials["FactionAccent"], major_segments=16)
    add_cylinder("Rotator drum", (0, 0, 0.42), 0.17, 0.13, materials["StructureDark"], bevel=0.016)
    for side in (-1, 1):
        add_box("Array pylon", (side * 0.13, 0.03, 0.53), (0.07, 0.11, 0.2), materials["StructureLight"], 0.012)

    array_centre = (0, 0.04, 0.68)
    add_box(
        "Planar array",
        array_centre,
        (0.72, 0.09, 0.3),
        materials["Ceramic"],
        0.02,
        rotation=(-RADAR_TILT, 0, 0),
    )
    add_box(
        "Array face",
        _on_array(array_centre, forward=0.06),
        (0.62, 0.03, 0.21),
        materials["StructureDark"],
        0.01,
        rotation=(-RADAR_TILT, 0, 0),
    )
    for lateral in (-0.22, 0.0, 0.22):
        add_box(
            "Emitter strip",
            _on_array(array_centre, forward=0.08, lateral=lateral),
            (0.13, 0.03, 0.15),
            materials["FactionAccent"],
            0.006,
            rotation=(-RADAR_TILT, 0, 0),
        )
    add_box(
        "Array spine",
        _on_array(array_centre, forward=-0.07),
        (0.66, 0.04, 0.08),
        materials["StructureLight"],
        0.008,
        rotation=(-RADAR_TILT, 0, 0),
    )
    add_box("Counterweight", (0, 0.2, 0.5), (0.28, 0.12, 0.1), materials["StructureDark"], 0.014)
    add_cylinder("Uplink mast", (0.24, 0.21, 0.47), 0.018, 0.28, materials["StructureDark"], vertices=6)
    add_facet_dome("Sweep beacon", (0.24, 0.21, 0.62), 0.038, materials["Energy"], flatten=1.0, subdivisions=1)


def build_colony_module(materials: Materials) -> None:
    """The hero piece. Deliberately the tallest and most massive of the buildings —
    it should be obvious at a glance which tile the colony is on."""
    add_plinth(materials)
    add_cylinder("Habitat footing", (-0.04, 0.02, 0.17), 0.36, 0.08, materials["StructureDark"], bevel=0.016)
    add_torus("Ring corridor", (-0.04, 0.02, 0.2), 0.36, 0.05, materials["StructureLight"], major_segments=16)
    add_facet_dome("Geodesic habitat", (-0.04, 0.02, 0.21), 0.38, materials["Ceramic"], flatten=0.92)
    add_torus("Habitat horizon band", (-0.04, 0.02, 0.31), 0.365, 0.028, materials["FactionAccent"])
    add_facet_dome("Dome cupola", (-0.04, 0.02, 0.58), 0.13, materials["StructureLight"], flatten=0.75, subdivisions=1)
    add_facet_dome("Cupola light", (-0.04, 0.02, 0.65), 0.06, materials["Energy"], flatten=0.8, subdivisions=1)
    # A second, smaller habitat annex. One dome reads as a tank; two joined domes
    # read as a settlement, which is what makes this piece the colony.
    add_facet_dome("Habitat annex", (0.26, 0.2, 0.16), 0.19, materials["Ceramic"], flatten=0.95, subdivisions=2)
    add_torus("Annex band", (0.26, 0.2, 0.22), 0.183, 0.02, materials["FactionAccent"], major_segments=12)
    add_box("Connecting corridor", (0.13, 0.12, 0.21), (0.24, 0.11, 0.11), materials["StructureLight"], 0.016)
    add_box("Airlock spine", (0.28, -0.19, 0.26), (0.2, 0.22, 0.2), materials["StructureLight"])
    add_box("Airlock door", (0.28, -0.29, 0.26), (0.12, 0.03, 0.13), materials["FactionAccent"], 0.008)
    for side in (-1, 1):
        add_box(
            "Radiator fin",
            (-0.3, side * 0.13, 0.42),
            (0.14, 0.03, 0.26),
            materials["FactionAccent"],
            0.008,
            rotation=(0, 0.25, 0),
        )
    add_cylinder("Beacon spire", (-0.05, 0.33, 0.6), 0.028, 0.5, materials["StructureDark"], vertices=6)
    add_facet_dome("Colony beacon", (-0.05, 0.33, 0.87), 0.06, materials["Energy"], flatten=1.0, subdivisions=1)


def build_material_cache(materials: Materials) -> None:
    """Loose earth-launched material. No plinth: it was dropped, not built."""
    add_box("Cargo tray", (0, 0, 0.045), (0.62, 0.44, 0.09), materials["StructureDark"], 0.022)
    add_box("Supply crate", (-0.12, 0.02, 0.19), (0.32, 0.3, 0.2), materials["StructureLight"])
    add_box("Crate signal panel", (-0.12, -0.14, 0.2), (0.18, 0.03, 0.09), materials["FactionAccent"], 0.006)
    add_cylinder("Sealed canister", (0.19, 0.09, 0.2), 0.1, 0.22, materials["Ceramic"], vertices=10, bevel=0.016)
    add_torus("Canister band", (0.19, 0.09, 0.24), 0.1, 0.018, materials["StructureDark"], major_segments=10)
    add_facet_dome("Mineral sample", (0.18, -0.14, 0.14), 0.075, materials["ResourceOre"], flatten=0.8, subdivisions=1)
    add_box("Tray handle", (0, 0.24, 0.13), (0.18, 0.04, 0.05), materials["StructureDark"], 0.01)


PIECE_BUILDERS = {
    "android": build_android,
    "material-cache": build_material_cache,
    "charger": build_charger,
    "depot": build_depot,
    "extractor": build_extractor,
    "processor": build_processor,
    "acid-processing-plant": build_acid_processing_plant,
    "relay-tower": build_relay_tower,
    "scanner": build_scanner,
    "radar": build_radar,
    "colony-module": build_colony_module,
}


def parse_arguments() -> argparse.Namespace:
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", choices=PIECE_BUILDERS.keys(), nargs="+")
    parser.add_argument("--contact-sheet", action="store_true", help="Render the whole set in one image and stop")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--preview-dir", type=Path, default=DEFAULT_PREVIEW_DIR)
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE_DIR)
    return parser.parse_args(arguments)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for material in bpy.data.materials:
        bpy.data.materials.remove(material)


def select_objects(objects: list[bpy.types.Object]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for object in objects:
        object.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def point_at(object: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - object.location
    object.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_review_lighting(target: tuple[float, float, float]) -> None:
    for location, energy, size, colour in (
        ((2.4, -2.8, 3.6), 760, 4.0, (1.0, 0.96, 0.9)),
        ((-3.0, 1.4, 1.9), 240, 3.0, (0.72, 0.82, 1.0)),
        ((0.4, 2.6, 2.8), 400, 2.0, (0.3, 0.6, 1.0)),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.data.energy = energy
        light.data.size = size
        light.data.color = colour
        point_at(light, target)


def configure_render(filepath: Path, width: int, height: int) -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.render.filepath = str(filepath)
    scene.world.color = (0.004, 0.006, 0.014)


def add_review_floor(_materials: Materials) -> None:
    """A matte backdrop. The metallic structure material mirrored the key light
    into a hotspot that made pieces hard to compare."""
    material = bpy.data.materials.get("Review floor") or bpy.data.materials.new("Review floor")
    material.use_nodes = True
    principled = material.node_tree.nodes.get("Principled BSDF")
    principled.inputs["Base Color"].default_value = (0.02, 0.024, 0.035, 1.0)
    principled.inputs["Metallic"].default_value = 0.0
    principled.inputs["Roughness"].default_value = 0.95
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, -0.002))
    floor = bpy.context.object
    floor.name = "Review floor"
    floor.data.materials.append(material)


def render_preview(piece_name: str, preview_dir: Path, materials: Materials) -> None:
    configure_render(preview_dir / f"{piece_name}.png", 512, 512)
    add_review_floor(materials)
    add_review_lighting((0, 0, 0.45))
    bpy.ops.object.camera_add(location=(1.85, -2.3, 1.62))
    camera = bpy.context.object
    camera.data.lens = 68
    point_at(camera, (0, 0, 0.42))
    bpy.context.scene.camera = camera
    bpy.ops.render.render(write_still=True)


def render_contact_sheet(preview_dir: Path, materials: Materials) -> None:
    """Lay the whole set out on a grid so the family can be judged at a glance."""
    columns = len(PIECE_BUILDERS)
    spacing = 1.2
    for index, piece_name in enumerate(PIECE_BUILDERS):
        existing = set(bpy.context.scene.objects)
        PIECE_BUILDERS[piece_name](materials)
        offset = Vector((((index % columns) - (columns - 1) / 2) * spacing, -(index // columns) * spacing, 0))
        for object in bpy.context.scene.objects:
            if object not in existing:
                object.location += offset
    rows = (len(PIECE_BUILDERS) + columns - 1) // columns
    width = columns * spacing
    centre = (0.0, -(rows - 1) * spacing / 2, 0.42)
    configure_render(preview_dir / "contact-sheet.png", 1900, 460)
    add_review_floor(materials)
    add_review_lighting(centre)
    bpy.ops.object.camera_add(location=(centre[0], centre[1] - 5.0, 2.6))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = width + 0.15
    point_at(camera, centre)
    bpy.context.scene.camera = camera
    bpy.ops.render.render(write_still=True)


def export_piece(piece_name: str, materials: Materials, arguments: argparse.Namespace) -> None:
    PIECE_BUILDERS[piece_name](materials)
    piece_objects = list(bpy.context.scene.objects)
    select_objects(piece_objects)
    bpy.ops.wm.save_as_mainfile(filepath=str(arguments.source_dir / f"{piece_name}.blend"))
    render_preview(piece_name, arguments.preview_dir, materials)
    select_objects(piece_objects)
    bpy.ops.export_scene.gltf(
        filepath=str(arguments.output_dir / f"{piece_name}.glb"),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
    )
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def main() -> None:
    arguments = parse_arguments()
    for directory in (arguments.output_dir, arguments.preview_dir, arguments.source_dir):
        directory.mkdir(parents=True, exist_ok=True)
    clear_scene()
    materials = create_materials()
    if arguments.contact_sheet:
        render_contact_sheet(arguments.preview_dir, materials)
        return
    for piece_name in arguments.only or list(PIECE_BUILDERS):
        export_piece(piece_name, materials, arguments)


if __name__ == "__main__":
    main()
