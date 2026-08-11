"""Generate Project Nova's android as a high-fidelity tabletop game piece.

The android is the first piece a player is given, so it sets the tone for the
whole set. This generator explores that piece at display-miniature fidelity:
baked surface texturing from `nova_surfaces.py`, posed limbs, and a proper base
plate, rather than the flat-shaded colour blocks of the original mock.

Run from the repository root:
  blender --background --factory-startup --python packages/renderer/blender/scripts/generate-android.py

Render all three variants side by side to choose between them:
  blender --background --factory-startup --python ... -- --contact-sheet

Build one variant, or send output somewhere other than the committed asset dirs:
  blender --background --factory-startup --python ... -- --only ranger --preview-dir /tmp/nova


## Designing from the rules

Every element of the silhouette is something the android does in
`packages/game/src/rules/rules.android.ts`, because a worker whose shape does not
explain its job is decoration:

  * **wide-stance legs and heavy feet** — `moveBatteryCost`, one tile at a time
  * **an open cargo cradle with ore visible in it** — `cargoCapacity`, ten units.
    The original mock had nowhere to put the ore it spends the game carrying.
  * **exposed battery cells on the rear pack** — `batteryCapacity`, one of the two
    clocks a script plays against, and the reason chargers exist
  * **a chest status monitor** — `startingHealth`, the other clock
  * **a nozzle tool arm** — `cleanAcidBatteryCost`, and construction work
  * **a gripper arm** — collecting and dismantling
  * **a wide sensor visor** — `sight`, range 2
  * **an antenna** — `broadcastLimit`

The visor and the base inlay carry `FactionAccent`, so ownership reads both from
a three-quarter view and from directly overhead where a visor is hidden.


## The base plate

The piece is a game piece, not a robot standing in dirt: it sits on a base plate
with a chamfered rim, a recessed gritty top, and a faction inlay along its front
edge. The rim is the widest thing at ground level and nothing overhangs it, which
is what keeps a piece inside its tile when the renderer packs several onto one.
"""

from __future__ import annotations

import argparse
import random
import sys
from dataclasses import dataclass
from math import pi, tan
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
    GROUND_TOP,
    add_base_plate,
    add_box,
    add_cone,
    add_cylinder,
    add_rounded_box,
    add_sphere,
    add_torus,
)
from nova_surfaces import create_piece_materials  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]

Materials = dict[str, bpy.types.Material]



@dataclass(frozen=True)
class AndroidDesign:
    """One android silhouette.

    The three presets differ along the axes that actually change how the piece
    reads at replay distance — leg length, stance width, how far it leans, and
    where the cargo sits — rather than in greeble detail nobody can resolve.
    """

    key: str
    title: str
    summary: str
    base_radius: float
    base_shape: str
    leg_length: float
    stance: float
    torso_width: float
    torso_depth: float
    torso_height: float
    lean: float
    neck_height: float
    head_width: float
    head_depth: float
    head_height: float
    pack_depth: float
    cargo: str


# The chosen design. It ships as plain `android`, the name the renderer and the
# site's piece catalogue already resolve; the unchosen variants keep a suffix and
# exist only for comparison renders.
CANONICAL_DESIGN = "surveyor"


DESIGNS = {
    "surveyor": AndroidDesign(
        key="surveyor",
        title="Surveyor",
        summary="Upright, balanced, round base. The current read, done properly.",
        base_radius=0.345,
        base_shape="round",
        leg_length=0.235,
        stance=0.150,
        torso_width=0.315,
        torso_depth=0.225,
        torso_height=0.275,
        lean=0.12,
        neck_height=0.030,
        head_width=0.215,
        head_depth=0.185,
        head_height=0.135,
        pack_depth=0.140,
        cargo="cradle",
    ),
    "packmule": AndroidDesign(
        key="packmule",
        title="Packmule",
        summary="Low, wide, hunched under a dorsal ore bin. Unmistakably a hauler.",
        base_radius=0.360,
        base_shape="hex",
        leg_length=0.165,
        stance=0.185,
        torso_width=0.340,
        torso_depth=0.265,
        torso_height=0.225,
        lean=0.30,
        neck_height=0.018,
        head_width=0.205,
        head_depth=0.200,
        head_height=0.115,
        pack_depth=0.170,
        cargo="hopper",
    ),
    "ranger": AndroidDesign(
        key="ranger",
        title="Ranger",
        summary="Tall, long-legged, small high head. Reads as a scout with character.",
        base_radius=0.330,
        base_shape="round",
        leg_length=0.315,
        stance=0.130,
        torso_width=0.265,
        torso_depth=0.195,
        torso_height=0.265,
        lean=0.08,
        neck_height=0.055,
        head_width=0.175,
        head_depth=0.160,
        head_height=0.125,
        pack_depth=0.125,
        cargo="cradle",
    ),
}


def asset_name(key: str) -> str:
    """Filename stem for a design's exported asset."""
    return "android" if key == CANONICAL_DESIGN else f"android-{key}"


# --------------------------------------------------------------------------
# the android
# --------------------------------------------------------------------------


def _cant(design: AndroidDesign, hip_z: float):
    """Shear everything above the hip forward, giving the piece a purposeful lean.

    Applied as a positional shear rather than a parent rotation so each part can
    still be placed in plain world coordinates and read as such.
    """

    def place(x: float, y: float, z: float) -> tuple[float, float, float]:
        return (x, y - (z - hip_z) * tan(design.lean), z)

    return place


def build_legs(materials: Materials, design: AndroidDesign, hip_z: float) -> None:
    length = design.leg_length
    for side in (-1, 1):
        x = side * design.stance
        add_sphere("Hip joint", (x, 0.0, hip_z), 0.055, materials["Chassis"])
        add_rounded_box(
            "Thigh",
            (x, 0.014, hip_z - length * 0.28),
            (0.105, 0.115, length * 0.54),
            materials["Graphite"],
            rotation=(-0.10, 0, 0),
        )
        add_cylinder(
            "Knee actuator",
            (x, -0.006, hip_z - length * 0.55),
            0.052,
            0.118,
            materials["Chassis"],
            vertices=16,
            rotation=(0, pi / 2, 0),
        )
        add_rounded_box(
            "Shin",
            (x, -0.016, hip_z - length * 0.78),
            (0.090, 0.100, length * 0.46),
            materials["Graphite"],
            rotation=(0.09, 0, 0),
        )
        # Hydraulics: the cheapest possible signal that a limb is powered.
        add_cylinder(
            "Shin piston", (x, 0.070, hip_z - length * 0.52), 0.017, length * 0.52, materials["Chassis"], vertices=10
        )
        add_sphere("Ankle joint", (x, -0.022, GROUND_TOP + 0.058), 0.040, materials["Chassis"])
        add_rounded_box(
            "Foot pad", (x, -0.042, GROUND_TOP + 0.030), (0.152, 0.238, 0.058), materials["Graphite"], bevel=0.018
        )
        add_box("Toe grip", (x, -0.148, GROUND_TOP + 0.022), (0.128, 0.058, 0.034), materials["Chassis"], 0.008)
        add_box("Heel block", (x, 0.062, GROUND_TOP + 0.024), (0.100, 0.052, 0.038), materials["Chassis"], 0.008)


def build_torso(materials: Materials, design: AndroidDesign, hip_z: float) -> tuple[float, float]:
    place = _cant(design, hip_z)
    bottom = hip_z + 0.015
    top = bottom + design.torso_height

    add_rounded_box(
        "Waist block",
        place(0, 0.010, bottom + 0.048),
        (design.torso_width * 0.70, design.torso_depth * 0.78, 0.096),
        materials["Chassis"],
        bevel=0.016,
    )
    add_torus(
        "Waist collar", place(0, 0.005, bottom + 0.012), design.torso_width * 0.40, 0.018, materials["Chassis"],
        major_segments=20,
    )
    # The one big smooth form on the piece. A single generous ceramic shell is
    # what stops a greebled robot reading as a pile of boxes.
    add_rounded_box(
        "Chest shell",
        place(0, 0.0, bottom + design.torso_height * 0.58),
        (design.torso_width, design.torso_depth, design.torso_height * 0.84),
        materials["Ceramic"],
        # A generous but not pillowy chamfer. At 0.058 the shell lost its edges
        # entirely and read as a moulded bath toy rather than a pressure hull.
        bevel=0.034,
        segments=3,
        rotation=(design.lean, 0, 0),
    )
    # A narrow spine rather than a broad plate, plus a hard horizontal break
    # across the shell. One uninterrupted cream mass with a badge in the middle
    # read as a domestic appliance; the spine and the break give the chest a
    # direction and a sense of assembly.
    add_rounded_box(
        "Chest spine",
        place(0, -design.torso_depth * 0.46, bottom + design.torso_height * 0.52),
        (design.torso_width * 0.26, 0.045, design.torso_height * 0.62),
        materials["Chassis"],
        bevel=0.012,
    )
    add_box(
        "Chest break",
        place(0, -design.torso_depth * 0.40, bottom + design.torso_height * 0.30),
        (design.torso_width * 0.96, design.torso_depth * 0.30, 0.026),
        materials["Chassis"],
        bevel=0.007,
    )
    # Health: the second clock, and the only status the hull itself reports. Kept
    # small and set into the spine — at replay distance the visor is the piece's
    # accent read, and a second big glow competes with it.
    add_box(
        "Status monitor",
        place(0, -design.torso_depth * 0.505, bottom + design.torso_height * 0.68),
        (design.torso_width * 0.17, 0.022, 0.036),
        materials["FactionAccent"],
        bevel=0.005,
    )
    add_rounded_box(
        "Shoulder yoke",
        place(0, 0.010, top - 0.030),
        (design.torso_width * 1.10, design.torso_depth * 0.74, 0.078),
        materials["Graphite"],
        bevel=0.018,
    )
    add_box(
        "Shoulder faction plate",
        place(-design.torso_width * 0.50, -0.010, top - 0.026),
        (0.058, 0.070, 0.022),
        materials["FactionAccent"],
        bevel=0.005,
    )
    return bottom, top


def build_pack(materials: Materials, design: AndroidDesign, hip_z: float, bottom: float) -> None:
    place = _cant(design, hip_z)
    depth = design.pack_depth
    y = design.torso_depth * 0.44 + depth * 0.44
    centre = bottom + design.torso_height * 0.55

    add_rounded_box(
        "Power pack",
        place(0, y, centre),
        (design.torso_width * 0.84, depth, design.torso_height * 0.70),
        materials["Graphite"],
        bevel=0.020,
    )
    # Battery: the clock the player watches, so it is exposed hardware rather
    # than a readout. Three cells so "partly drained" is imaginable at a glance.
    for index, offset in enumerate((-1, 0, 1)):
        add_box(
            "Power cell",
            place(offset * design.torso_width * 0.24, y + depth * 0.50, centre),
            (design.torso_width * 0.15, 0.026, design.torso_height * 0.46),
            materials["Energy"],
            bevel=0.006,
        )
    for index in range(3):
        add_box(
            "Heat fin",
            place(0, y + depth * 0.10, centre + design.torso_height * 0.40 + index * 0.030),
            (design.torso_width * 0.88, depth * 0.86, 0.014),
            materials["Chassis"],
            bevel=0.004,
        )


def build_cargo(materials: Materials, design: AndroidDesign, hip_z: float, top: float) -> None:
    """Somewhere for the ten units of ore to actually ride.

    `cradle` hangs a tray off the hip, keeping the piece's height down.
    `hopper` puts a bin over the shoulders, which dominates the silhouette and
    makes the hauler read from across the table.
    """
    place = _cant(design, hip_z)
    ore = random.Random(4)

    if design.cargo == "hopper":
        width = design.torso_width * 1.04
        depth = design.pack_depth * 1.55
        floor_z = top + 0.055
        add_rounded_box(
            "Ore bin floor", place(0, design.torso_depth * 0.24, floor_z), (width, depth, 0.030),
            materials["Graphite"], bevel=0.010,
        )
        for side in (-1, 1):
            add_rounded_box(
                "Ore bin wall",
                place(side * width * 0.5, design.torso_depth * 0.24, floor_z + 0.062),
                (0.028, depth, 0.125),
                materials["Chassis"],
                bevel=0.008,
            )
        for side in (-1, 1):
            add_rounded_box(
                "Ore bin end",
                place(0, design.torso_depth * 0.24 + side * depth * 0.5, floor_z + 0.062),
                (width, 0.028, 0.125),
                materials["Chassis"],
                bevel=0.008,
            )
        for index in range(6):
            add_sphere(
                "Ore load",
                place(
                    ore.uniform(-width * 0.34, width * 0.34),
                    design.torso_depth * 0.24 + ore.uniform(-depth * 0.32, depth * 0.32),
                    floor_z + 0.045,
                ),
                ore.uniform(0.030, 0.046),
                materials["ResourceOre"],
                subdivisions=1,
                smooth=False,
            )
        return

    # Open-topped hip panniers rather than one tray on the back.
    #
    # The board camera is a fixed three-quarter view and androids turn to face
    # where they are walking, so a rear-mounted tray spends most of the game
    # hidden behind the torso. "This one is carrying ore" has to be true from any
    # facing, which means the load rides on the sides, open to the sky.
    width = 0.115
    depth = design.pack_depth * 1.15
    # Set back behind the arm line and dropped below it. At hip height and level
    # with the shoulders the panniers occupied exactly the volume the arms hang
    # through, and the two merged into one unreadable mass on both sides.
    pannier_y = 0.115
    floor_z = hip_z - 0.058
    for side in (-1, 1):
        x = side * (design.torso_width * 0.5 + 0.085)
        add_rounded_box(
            "Pannier floor", place(x, pannier_y, floor_z), (width, depth, 0.026), materials["Chassis"], bevel=0.007
        )
        for offset in (side * width * 0.5, -side * width * 0.5):
            add_box(
                "Pannier wall", place(x + offset, pannier_y, floor_z + 0.050), (0.022, depth, 0.086),
                materials["Chassis"], 0.006,
            )
        for end in (-1, 1):
            add_box(
                "Pannier end", place(x, pannier_y + end * depth * 0.5, floor_z + 0.050), (width, 0.022, 0.086),
                materials["Chassis"], 0.006,
            )
        add_box(
            "Pannier mount", place(side * (design.torso_width * 0.5 + 0.030), pannier_y, floor_z + 0.030),
            (0.070, depth * 0.5, 0.040), materials["Graphite"], 0.006,
        )
        for index in range(2):
            add_sphere(
                "Ore load",
                place(
                    x + ore.uniform(-width * 0.18, width * 0.18),
                    pannier_y + ore.uniform(-depth * 0.26, depth * 0.26),
                    floor_z + 0.046,
                ),
                ore.uniform(0.030, 0.040),
                materials["ResourceOre"],
                subdivisions=1,
                smooth=False,
            )


def build_arms(materials: Materials, design: AndroidDesign, hip_z: float, top: float) -> None:
    """Deliberately asymmetric: a gripper and a nozzle.

    Two identical arms read as a mannequin. Different tools read as a machine
    built for a job, and give the piece a front and a handedness at a glance.
    """
    place = _cant(design, hip_z)
    shoulder_z = top - 0.050
    for side in (-1, 1):
        shoulder_x = side * (design.torso_width * 0.5 + 0.055)
        elbow_x = side * (design.torso_width * 0.5 + 0.030)
        # The forearms converge toward the centreline, which reads as a machine
        # holding its tools ready and — the binding constraint — keeps the tools
        # inside the base plate's radius. Arms straight out at the shoulder line
        # put the nozzle tip past the rim, and an overhanging piece collides with
        # its neighbours the moment the renderer packs two onto one tile.
        tool_x = side * design.torso_width * 0.34
        tool_y = -0.225
        # Tools ride at chest height, not at the hip. The board camera looks down
        # at the piece, so anything held low disappears behind the pelvis and the
        # two arms stop being distinguishable — which is the whole point of giving
        # the android a gripper on one side and a nozzle on the other.
        tool_z = shoulder_z - 0.115

        add_sphere("Shoulder joint", place(shoulder_x, 0.005, shoulder_z), 0.058, materials["Chassis"])
        add_rounded_box(
            "Upper arm",
            place(shoulder_x, 0.028, shoulder_z - 0.075),
            (0.090, 0.100, 0.165),
            materials["Graphite"],
            rotation=(0.30, 0, 0),
            bevel=0.016,
        )
        add_cylinder(
            "Elbow joint",
            place(elbow_x, -0.026, shoulder_z - 0.150),
            0.048,
            0.104,
            materials["Chassis"],
            vertices=14,
            rotation=(0, pi / 2, 0),
        )
        add_rounded_box(
            "Forearm",
            place(side * design.torso_width * 0.42, -0.128, shoulder_z - 0.135),
            (0.082, 0.205, 0.090),
            materials["Chassis"],
            bevel=0.014,
            rotation=(-0.22, 0, side * 0.30),
        )

        if side < 0:
            # Gripper: collect, deposit, dismantle.
            add_box(
                "Gripper mount", place(tool_x, tool_y + 0.046, tool_z), (0.096, 0.052, 0.078), materials["Graphite"], 0.008
            )
            for jaw in (-1, 1):
                add_rounded_box(
                    "Gripper jaw",
                    place(tool_x + jaw * 0.034, tool_y, tool_z),
                    (0.030, 0.098, 0.062),
                    materials["Chassis"],
                    rotation=(0, 0, jaw * 0.24),
                    bevel=0.007,
                )
        else:
            # Nozzle: clean acid, and site work during construction.
            #
            # Deliberately no acid-lime accent. The piece already carries faction
            # cyan, energy amber, and ore orange; a fourth accent competes with
            # the visor, and lime on an android reads as acid damage rather than
            # as the tool that removes it.
            add_cylinder(
                "Nozzle housing",
                place(tool_x, tool_y + 0.030, tool_z),
                0.046,
                0.104,
                materials["Graphite"],
                vertices=14,
                rotation=(pi / 2, 0, 0),
            )
            add_cone(
                "Nozzle tip",
                place(tool_x, tool_y - 0.044, tool_z),
                0.038,
                0.015,
                0.062,
                materials["Chassis"],
                rotation=(-pi / 2, 0, 0),
                vertices=14,
            )
            add_torus(
                "Nozzle collar",
                place(tool_x, tool_y - 0.012, tool_z),
                0.034,
                0.010,
                materials["Chassis"],
                rotation=(pi / 2, 0, 0),
                major_segments=14,
            )


def build_head(materials: Materials, design: AndroidDesign, hip_z: float, top: float) -> None:
    place = _cant(design, hip_z)
    centre_z = top + design.neck_height + design.head_height * 0.5

    add_cylinder(
        "Neck", place(0, 0.012, top + design.neck_height * 0.5), 0.050, max(design.neck_height, 0.02) + 0.02,
        materials["Chassis"], vertices=14,
    )
    add_rounded_box(
        "Sensor housing",
        place(0, -0.012, centre_z),
        (design.head_width, design.head_depth, design.head_height),
        materials["Graphite"],
        bevel=0.040,
        segments=3,
        rotation=(design.lean, 0, 0),
    )
    # The hero accent. One wide visor beats a pair of eyes: it reads as a scanner
    # at replay distance and as ownership at any distance.
    add_rounded_box(
        "Optical visor",
        place(0, -design.head_depth * 0.50, centre_z + design.head_height * 0.10),
        (design.head_width * 0.84, 0.038, design.head_height * 0.34),
        materials["FactionAccent"],
        bevel=0.010,
        segments=2,
    )
    add_box(
        "Visor brow",
        place(0, -design.head_depth * 0.48, centre_z + design.head_height * 0.36),
        (design.head_width * 0.94, 0.060, 0.030),
        materials["Chassis"],
        bevel=0.008,
    )
    for side in (-1, 1):
        add_cylinder(
            "Sensor pod",
            place(side * design.head_width * 0.52, -0.010, centre_z),
            0.030,
            0.040,
            materials["Chassis"],
            vertices=12,
            rotation=(0, pi / 2, 0),
        )
    antenna_base = centre_z + design.head_height * 0.5
    add_cylinder(
        "Antenna", place(design.head_width * 0.40, 0.062, antenna_base + 0.075), 0.011, 0.150,
        materials["Chassis"], vertices=8,
    )
    add_sphere(
        "Antenna beacon", place(design.head_width * 0.40, 0.062, antenna_base + 0.155), 0.026,
        materials["FactionAccent"], subdivisions=1,
    )


def build_android(materials: Materials, design: AndroidDesign) -> None:
    hip_z = GROUND_TOP + design.leg_length
    add_base_plate(materials, design.base_radius, design.base_shape)
    build_legs(materials, design, hip_z)
    bottom, top = build_torso(materials, design, hip_z)
    build_pack(materials, design, hip_z, bottom)
    build_cargo(materials, design, hip_z, top)
    build_arms(materials, design, hip_z, top)
    build_head(materials, design, hip_z, top)


# --------------------------------------------------------------------------
# build
# --------------------------------------------------------------------------


def build_piece(design: AndroidDesign, arguments: argparse.Namespace) -> None:
    clear_scene()
    build_android(create_piece_materials(), design)
    finish_piece(asset_name(design.key), arguments)


def build_variant_sheet(arguments: argparse.Namespace) -> None:
    """All three variants in one row.

    Baking is skipped on purpose: this shot is about silhouette and proportion,
    and an atlas per variant would triple the cost of the one render whose whole
    job is being a fast side-by-side.
    """
    clear_scene()
    materials = create_piece_materials()
    spacing = 1.15
    designs = list(DESIGNS.values())
    for index, design in enumerate(designs):
        existing = set(bpy.context.scene.objects)
        build_android(materials, design)
        offset = (index - (len(designs) - 1) / 2) * spacing
        for object in bpy.context.scene.objects:
            if object not in existing:
                object.location.x += offset
    render_contact_sheet(
        arguments.preview_dir / "android-variants.png",
        len(designs),
        spacing,
        arguments.render_samples,
        arguments.lighting,
        not arguments.no_bloom,
    )
    print("NOVA: rendered android-variants.png")


def parse_arguments() -> argparse.Namespace:
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", choices=DESIGNS.keys(), nargs="+")
    add_common_arguments(parser, ROOT)
    return parser.parse_args(arguments)


def main() -> None:
    arguments = parse_arguments()
    prepare_directories(arguments)
    if arguments.contact_sheet:
        build_variant_sheet(arguments)
        return
    # A bare run builds only the chosen design, so the committed asset directories
    # never collect exploration variants as a side effect.
    for key in arguments.only or [CANONICAL_DESIGN]:
        build_piece(DESIGNS[key], arguments)


if __name__ == "__main__":
    main()
