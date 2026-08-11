"""Generate Project Nova's tabletop pieces as textured game pieces.

Run from the repository root:
  blender --background --factory-startup --python packages/renderer/blender/scripts/generate-nova-pieces.py

Judge the set as a family before judging any single piece:
  blender --background --factory-startup --python ... -- --contact-sheet

Build one piece, or send output somewhere other than the committed asset dirs:
  blender --background --factory-startup --python ... -- --only radar --preview-dir /tmp/nova

This module owns *geometry only*. Materials and the bake come from
`nova_surfaces.py`; everything that happens to a piece after it is modelled comes
from `nova_build.py`, so no piece can be exported under different rules from the
rest of the set.

The android is not here — it is built by `generate-android.py`, which carries the
parametric design and its unchosen variants.
"""

from __future__ import annotations

import argparse
import sys
from math import cos, pi, sin
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))

from nova_build import (  # noqa: E402
    add_common_arguments,
    clear_scene,
    finish_piece,
    prepare_directories,
    render_contact_sheet,
)
from nova_kit import (  # noqa: E402
    BASE_RADIUS,
    GROUND_TOP,
    add_base_plate,
    add_box,
    add_chevrons,
    add_collar,
    add_cone,
    add_cylinder,
    add_facet_dome,
    add_lattice_mast,
    add_torus,
)
from nova_surfaces import create_piece_materials  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]

Materials = dict[str, bpy.types.Material]

# The builders below place geometry measured from the old plinth's deck top. The
# new base plate is slimmer, so bodies are dropped by the difference once built,
# rather than rewriting several hundred hand-tuned coordinates.
LEGACY_DECK_TOP = 0.137
BODY_DROP = LEGACY_DECK_TOP - GROUND_TOP


def build_charger(materials: Materials) -> None:
    """U-shaped gantry over a circular pad. Reads as a gate from any angle."""
    add_cylinder("Induction pad", (0, -0.05, 0.16), 0.26, 0.06, materials["Graphite"], bevel=0.012)
    add_torus("Charging ring", (0, -0.05, 0.2), 0.19, 0.028, materials["Energy"])
    add_facet_dome("Pad emitter", (0, -0.05, 0.2), 0.07, materials["Energy"], flatten=0.5, subdivisions=1)
    for side in (-1, 1):
        add_box("Gantry upright", (side * 0.29, 0.06, 0.44), (0.11, 0.15, 0.62), materials["Ceramic"])
        add_box("Upright conduit", (side * 0.29, -0.04, 0.44), (0.05, 0.05, 0.5), materials["FactionAccent"], 0.01)
    add_box("Gantry crossbeam", (0, 0.06, 0.78), (0.69, 0.14, 0.11), materials["Ceramic"])
    add_box("Crossbeam emitter", (0, -0.02, 0.71), (0.3, 0.06, 0.06), materials["Energy"], 0.012)
    add_cylinder("Reactor drum", (0, 0.27, 0.34), 0.12, 0.4, materials["Graphite"], bevel=0.02)
    add_cylinder("Reactor core", (0, 0.27, 0.36), 0.07, 0.42, materials["FactionAccent"])
    add_torus("Reactor collar", (0, 0.27, 0.52), 0.12, 0.022, materials["Chassis"], major_segments=12)


def build_depot(materials: Materials) -> None:
    """Asymmetric stack of sealed crates. Deliberately the most mundane silhouette."""
    add_box("Depot deck", (0, 0.02, 0.18), (0.72, 0.62, 0.08), materials["Graphite"], 0.02)
    add_box("Primary cargo pod", (-0.15, 0.05, 0.37), (0.4, 0.46, 0.31), materials["Ceramic"])
    add_box("Pod faction panel", (-0.15, -0.19, 0.38), (0.26, 0.03, 0.14), materials["FactionAccent"], 0.008)
    add_box("Stacked pod", (-0.15, 0.09, 0.6), (0.3, 0.34, 0.16), materials["Chassis"], 0.024)
    add_box("Utility crate", (0.25, 0.14, 0.33), (0.24, 0.32, 0.23), materials["Graphite"])
    add_box("Sample tray", (0.25, -0.16, 0.26), (0.22, 0.2, 0.08), materials["Chassis"], 0.016)
    for offset in (-0.28, 0.02):
        add_box("Cargo clamp", (offset, -0.28, 0.2), (0.07, 0.06, 0.12), materials["Energy"], 0.008)
    add_cylinder("Inventory mast", (0.29, 0.24, 0.58), 0.028, 0.34, materials["Graphite"], vertices=6)
    add_facet_dome("Inventory beacon", (0.29, 0.24, 0.77), 0.055, materials["FactionAccent"], flatten=1.0, subdivisions=1)


def build_extractor(materials: Materials) -> None:
    """Drill derrick. Four converging legs give it a unique triangular read."""
    for x, y in ((-0.26, -0.24), (0.26, -0.24), (-0.26, 0.24), (0.26, 0.24)):
        add_box(
            "Derrick leg",
            (x * 0.62, y * 0.62, 0.44),
            (0.07, 0.07, 0.74),
            materials["Graphite"],
            bevel=0.012,
            rotation=(y * 0.5, -x * 0.5, 0),
        )
    add_box("Derrick collar", (0, 0, 0.5), (0.34, 0.34, 0.05), materials["Chassis"], 0.014)
    add_torus("Drill warning ring", (0, 0, 0.22), 0.22, 0.03, materials["ResourceOre"])
    add_cylinder("Drill housing", (0, 0, 0.3), 0.15, 0.32, materials["Ceramic"], bevel=0.02)
    add_cone("Ore drill", (0, 0, 0.68), 0.11, 0.03, 0.42, materials["Graphite"])
    add_facet_dome("Derrick crown", (0, 0, 0.86), 0.1, materials["Chassis"], flatten=0.5, subdivisions=1)
    add_cylinder("Ore hopper", (0.28, 0.24, 0.3), 0.13, 0.36, materials["Graphite"], bevel=0.02)
    add_box("Ore chute", (0.28, -0.04, 0.26), (0.13, 0.34, 0.1), materials["ResourceOre"], 0.012)


def build_processor(materials: Materials) -> None:
    """Squared plant with twin stacks. The tallest standard building."""
    add_box("Furnace housing", (0.16, 0.02, 0.34), (0.44, 0.52, 0.4), materials["Graphite"])
    add_collar(materials, (-0.19, 0.02, 0.16), 0.21)
    add_cylinder("Pressure vessel", (-0.19, 0.02, 0.42), 0.2, 0.54, materials["Ceramic"], bevel=0.03)
    add_torus("Vessel heat band", (-0.19, 0.02, 0.34), 0.2, 0.026, materials["Energy"])
    add_box("Molten output", (0.16, -0.25, 0.34), (0.24, 0.03, 0.15), materials["Energy"], 0.008)
    for x in (0.03, 0.29):
        add_cylinder("Refinery stack", (x, 0.16, 0.74), 0.062, 0.42, materials["Graphite"], vertices=8)
        add_cone("Stack crown", (x, 0.16, 0.98), 0.088, 0.055, 0.08, materials["Chassis"], vertices=8)
    add_cylinder("Ore inlet", (-0.19, -0.3, 0.26), 0.075, 0.22, materials["ResourceOre"], rotation=(pi / 2, 0, 0))


def build_acid_processing_plant(materials: Materials) -> None:
    """Contained tank with external pipework, chevron-marked as a hazard system."""
    add_collar(materials, (-0.13, 0.03, 0.16), 0.23)
    add_cylinder("Containment tank", (-0.13, 0.03, 0.44), 0.22, 0.58, materials["Chassis"], bevel=0.03)
    add_box("Acid sight glass", (-0.13, -0.22, 0.44), (0.09, 0.04, 0.3), materials["HazardAcid"], 0.012)
    add_torus("Containment collar", (-0.13, 0.03, 0.7), 0.22, 0.026, materials["Ceramic"])
    add_facet_dome("Scrubber cap", (-0.13, 0.03, 0.74), 0.19, materials["Ceramic"], flatten=0.5)
    add_box("Neutralisation rig", (0.26, 0.06, 0.32), (0.3, 0.42, 0.36), materials["Graphite"])
    add_box("Acid monitor", (0.26, -0.16, 0.36), (0.16, 0.03, 0.14), materials["HazardAcid"], 0.008)
    add_cylinder("Transfer canister", (0.28, 0.22, 0.62), 0.06, 0.28, materials["HazardAcid"], vertices=8)
    for z in (0.3, 0.5):
        add_torus("Tank pipe", (-0.13, 0.03, z), 0.26, 0.022, materials["Graphite"], major_segments=12)
    add_chevrons(materials, (0.26, -0.27, 0.19), 0.24)


def build_relay_tower(materials: Materials) -> None:
    """Thin braced mast with an offset dish. The narrowest, tallest silhouette."""
    add_lattice_mast(materials, 0.13, 0.82, spread=0.085)
    add_box("Mast platform", (0, 0, 0.96), (0.3, 0.3, 0.045), materials["Chassis"], 0.012)
    add_box("Dish arm", (0, -0.16, 0.78), (0.055, 0.3, 0.055), materials["Graphite"], 0.01)
    add_cone("Directional dish", (0, -0.31, 0.78), 0.3, 0.07, 0.18, materials["Ceramic"], rotation=(pi / 2, 0, 0))
    add_torus("Dish signal ring", (0, -0.39, 0.78), 0.21, 0.024, materials["FactionAccent"], rotation=(pi / 2, 0, 0))
    add_facet_dome("Dish feed", (0, -0.4, 0.78), 0.055, materials["FactionAccent"], flatten=1.0, subdivisions=1)
    add_cylinder("Beacon spire", (0, 0.05, 1.06), 0.022, 0.16, materials["Graphite"], vertices=6)
    add_facet_dome("Relay beacon", (0, 0.05, 1.16), 0.055, materials["FactionAccent"], flatten=1.0, subdivisions=1)


def build_scanner(materials: Materials) -> None:
    """Low pedestal dominated by a wide tilted dish."""
    add_collar(materials, (0, 0.06, 0.16), 0.19)
    add_cone("Scanner pedestal", (0, 0.06, 0.3), 0.19, 0.13, 0.3, materials["Ceramic"])
    add_cylinder("Dish pivot", (0, 0.02, 0.47), 0.09, 0.22, materials["Graphite"], rotation=(0, pi / 2, 0))
    add_cone(
        "Wide sensor dish", (0, -0.09, 0.6), 0.38, 0.09, 0.16, materials["Chassis"], rotation=(1.15, 0, 0)
    )
    add_torus(
        "Scan ring", (0, -0.15, 0.66), 0.27, 0.022, materials["FactionAccent"], rotation=(1.15, 0, 0), major_segments=16
    )
    add_facet_dome("Scan emitter", (0, -0.13, 0.64), 0.07, materials["FactionAccent"], flatten=0.6, subdivisions=1)
    add_cylinder("Uplink antenna", (0.2, 0.2, 0.52), 0.018, 0.4, materials["Graphite"], vertices=6)
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
    add_collar(materials, (0, 0, 0.16), 0.26)
    add_cylinder("Turret base", (0, 0, 0.25), 0.26, 0.2, materials["Ceramic"], bevel=0.02)
    add_torus("Rotation race", (0, 0, 0.34), 0.26, 0.026, materials["FactionAccent"], major_segments=16)
    add_cylinder("Rotator drum", (0, 0, 0.42), 0.17, 0.13, materials["Graphite"], bevel=0.016)
    for side in (-1, 1):
        add_box("Array pylon", (side * 0.13, 0.03, 0.53), (0.07, 0.11, 0.2), materials["Chassis"], 0.012)

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
        materials["Graphite"],
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
        materials["Chassis"],
        0.008,
        rotation=(-RADAR_TILT, 0, 0),
    )
    add_box("Counterweight", (0, 0.2, 0.5), (0.28, 0.12, 0.1), materials["Graphite"], 0.014)
    add_cylinder("Uplink mast", (0.24, 0.21, 0.47), 0.018, 0.28, materials["Graphite"], vertices=6)
    add_facet_dome("Sweep beacon", (0.24, 0.21, 0.62), 0.038, materials["Energy"], flatten=1.0, subdivisions=1)


def build_colony_module(materials: Materials) -> None:
    """The hero piece. Deliberately the tallest and most massive of the buildings —
    it should be obvious at a glance which tile the colony is on."""
    add_cylinder("Habitat footing", (-0.04, 0.02, 0.17), 0.36, 0.08, materials["Graphite"], bevel=0.016)
    add_torus("Ring corridor", (-0.04, 0.02, 0.2), 0.36, 0.05, materials["Chassis"], major_segments=16)
    add_facet_dome("Geodesic habitat", (-0.04, 0.02, 0.21), 0.38, materials["Ceramic"], flatten=0.92)
    add_torus("Habitat horizon band", (-0.04, 0.02, 0.31), 0.365, 0.028, materials["FactionAccent"])
    add_facet_dome("Dome cupola", (-0.04, 0.02, 0.58), 0.13, materials["Chassis"], flatten=0.75, subdivisions=1)
    add_facet_dome("Cupola light", (-0.04, 0.02, 0.65), 0.06, materials["Energy"], flatten=0.8, subdivisions=1)
    # A second, smaller habitat annex. One dome reads as a tank; two joined domes
    # read as a settlement, which is what makes this piece the colony.
    add_facet_dome("Habitat annex", (0.26, 0.2, 0.16), 0.19, materials["Ceramic"], flatten=0.95, subdivisions=2)
    add_torus("Annex band", (0.26, 0.2, 0.22), 0.183, 0.02, materials["FactionAccent"], major_segments=12)
    add_box("Connecting corridor", (0.13, 0.12, 0.21), (0.24, 0.11, 0.11), materials["Chassis"], 0.016)
    add_box("Airlock spine", (0.28, -0.19, 0.26), (0.2, 0.22, 0.2), materials["Chassis"])
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
    add_cylinder("Beacon spire", (-0.05, 0.33, 0.6), 0.028, 0.5, materials["Graphite"], vertices=6)
    add_facet_dome("Colony beacon", (-0.05, 0.33, 0.87), 0.06, materials["Energy"], flatten=1.0, subdivisions=1)


def build_material_cache(materials: Materials) -> None:
    """Loose earth-launched material. No plinth: it was dropped, not built."""
    add_box("Cargo tray", (0, 0, 0.045), (0.62, 0.44, 0.09), materials["Graphite"], 0.022)
    add_box("Supply crate", (-0.12, 0.02, 0.19), (0.32, 0.3, 0.2), materials["Chassis"])
    add_box("Crate signal panel", (-0.12, -0.14, 0.2), (0.18, 0.03, 0.09), materials["FactionAccent"], 0.006)
    add_cylinder("Sealed canister", (0.19, 0.09, 0.2), 0.1, 0.22, materials["Ceramic"], vertices=10, bevel=0.016)
    add_torus("Canister band", (0.19, 0.09, 0.24), 0.1, 0.018, materials["Graphite"], major_segments=10)
    add_facet_dome("Mineral sample", (0.18, -0.14, 0.14), 0.075, materials["ResourceOre"], flatten=0.8, subdivisions=1)
    add_box("Tray handle", (0, 0.24, 0.13), (0.18, 0.04, 0.05), materials["Graphite"], 0.01)


# The android lives in generate-android.py: it is built at display-miniature
# fidelity with baked surface texturing, and both scripts writing android.glb
# would mean whichever ran last won.
# Every piece stands on a base plate except the loose material cache, which was
# dropped from orbit rather than built. `None` means no base.
PIECES = {
    "material-cache": (build_material_cache, None),
    "charger": (build_charger, BASE_RADIUS),
    "depot": (build_depot, BASE_RADIUS),
    "extractor": (build_extractor, BASE_RADIUS),
    "processor": (build_processor, BASE_RADIUS),
    "acid-processing-plant": (build_acid_processing_plant, BASE_RADIUS),
    # Narrower, so the mast reads as slender rather than planted on a dinner plate.
    "relay-tower": (build_relay_tower, 0.32),
    "scanner": (build_scanner, BASE_RADIUS),
    "radar": (build_radar, BASE_RADIUS),
    "colony-module": (build_colony_module, BASE_RADIUS),
}


def build_piece(piece_name: str, materials: Materials) -> None:
    """Model one piece: body, dropped onto its base plate."""
    builder, base_radius = PIECES[piece_name]
    existing = set(bpy.context.scene.objects)
    builder(materials)
    for object in bpy.context.scene.objects:
        if object not in existing:
            object.location.z -= BODY_DROP
    if base_radius is not None:
        add_base_plate(materials, base_radius)


def parse_arguments() -> argparse.Namespace:
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", choices=PIECES.keys(), nargs="+")
    add_common_arguments(parser, ROOT)
    return parser.parse_args(arguments)


def build_contact_sheet(arguments: argparse.Namespace) -> None:
    """The whole set in one row, so the family can be judged for coherence and
    for silhouette distinctness at a glance."""
    clear_scene()
    materials = create_piece_materials()
    spacing = 1.2
    names = list(PIECES)
    for index, piece_name in enumerate(names):
        existing = set(bpy.context.scene.objects)
        build_piece(piece_name, materials)
        offset = (index - (len(names) - 1) / 2) * spacing
        for object in bpy.context.scene.objects:
            if object not in existing:
                object.location.x += offset
    render_contact_sheet(
        arguments.preview_dir / "contact-sheet.png",
        len(names),
        spacing,
        arguments.render_samples,
        arguments.lighting,
        not arguments.no_bloom,
    )
    print("NOVA: rendered contact-sheet.png")


def main() -> None:
    arguments = parse_arguments()
    prepare_directories(arguments)
    if arguments.contact_sheet:
        build_contact_sheet(arguments)
        return
    for piece_name in arguments.only or list(PIECES):
        clear_scene()
        build_piece(piece_name, create_piece_materials())
        finish_piece(piece_name, arguments)


if __name__ == "__main__":
    main()
