"""Generate Project Nova's low-poly frontier sci-fi tabletop pieces.

Run from the repository root:
  blender --background --python packages/renderer/blender/scripts/generate-nova-pieces.py

Pass arguments after `--` to limit the export or change its location:
  blender --background --python ... -- --only android charger --output-dir /tmp/nova-models

The script saves one editable source blend, a PNG review render, and one GLB per piece.
"""

from __future__ import annotations

import argparse
import sys
from math import pi
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT_DIR = ROOT / "assets" / "models"
DEFAULT_PREVIEW_DIR = ROOT / "assets" / "previews"
DEFAULT_SOURCE_DIR = ROOT / "blender" / "source"

MATERIALS = {
    "StructureDark": (0.018, 0.03, 0.055, 1.0),
    "StructureLight": (0.18, 0.25, 0.33, 1.0),
    "Ceramic": (0.47, 0.52, 0.54, 1.0),
    "FactionAccent": (0.015, 0.32, 0.7, 1.0),
    "Energy": (1.0, 0.25, 0.012, 1.0),
    "HazardAcid": (0.24, 0.75, 0.01, 1.0),
    "ResourceOre": (0.95, 0.12, 0.018, 1.0),
    "Warning": (0.9, 0.025, 0.05, 1.0),
}


def parse_arguments() -> argparse.Namespace:
    arguments = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", choices=PIECE_BUILDERS.keys(), nargs="+")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--preview-dir", type=Path, default=DEFAULT_PREVIEW_DIR)
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE_DIR)
    return parser.parse_args(arguments)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for material in bpy.data.materials:
        bpy.data.materials.remove(material)


def create_materials() -> dict[str, bpy.types.Material]:
    materials = {}
    for name, colour in MATERIALS.items():
        material = bpy.data.materials.new(name)
        material.diffuse_color = colour
        material.use_nodes = True
        principled = material.node_tree.nodes.get("Principled BSDF")
        principled.inputs["Base Color"].default_value = colour
        principled.inputs["Metallic"].default_value = 0.62 if name.startswith("Structure") else 0.18
        principled.inputs["Roughness"].default_value = 0.42 if name == "Ceramic" else 0.5
        if name in {"FactionAccent", "Energy", "HazardAcid"}:
            principled.inputs["Emission Color"].default_value = colour
            principled.inputs["Emission Strength"].default_value = 0.2
        materials[name] = material
    return materials


def add_box(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    bevel: float = 0.025,
    rotation: tuple[float, float, float] = (0, 0, 0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    object = bpy.context.object
    object.name = name
    object.scale = tuple(value / 2 for value in scale)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        modifier = object.modifiers.new("Soft tabletop edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 1
        bpy.context.view_layer.objects.active = object
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    object.data.materials.append(material)
    return object


def add_cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    depth: float,
    material: bpy.types.Material,
    vertices: int = 10,
    rotation: tuple[float, float, float] = (0, 0, 0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    object = bpy.context.object
    object.name = name
    object.data.materials.append(material)
    return object


def add_cone(
    name: str,
    location: tuple[float, float, float],
    radius_1: float,
    radius_2: float,
    depth: float,
    material: bpy.types.Material,
    rotation: tuple[float, float, float] = (0, 0, 0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=radius_1, radius2=radius_2, depth=depth, location=location, rotation=rotation)
    object = bpy.context.object
    object.name = name
    object.data.materials.append(material)
    return object


def add_sphere(
    name: str,
    location: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=5, location=location)
    object = bpy.context.object
    object.name = name
    object.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    object.data.materials.append(material)
    return object


def add_torus(
    name: str,
    location: tuple[float, float, float],
    major_radius: float,
    minor_radius: float,
    material: bpy.types.Material,
    rotation: tuple[float, float, float] = (0, 0, 0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=10,
        minor_segments=4,
        location=location,
        rotation=rotation,
    )
    object = bpy.context.object
    object.name = name
    object.data.materials.append(material)
    return object


def add_piece_base(materials: dict[str, bpy.types.Material], radius: float = 0.44) -> None:
    add_cylinder("Hexagonal foundation", (0, 0, 0.05), radius, 0.1, materials["StructureDark"], vertices=10)
    add_cylinder("Ceramic foundation inset", (0, 0, 0.105), radius * 0.78, 0.025, materials["Ceramic"], vertices=10)


def build_android(materials: dict[str, bpy.types.Material]) -> None:
    add_piece_base(materials, 0.34)
    for x, y, angle in ((-0.17, -0.12, -0.3), (0.17, -0.12, 0.3), (-0.17, 0.14, 0.3), (0.17, 0.14, -0.3)):
        add_box("Articulated leg", (x, y, 0.22), (0.09, 0.11, 0.25), materials["StructureDark"], rotation=(0, angle, 0))
        add_box("Clawed foot", (x, y - 0.025, 0.135), (0.14, 0.17, 0.06), materials["StructureLight"], 0.012)
    add_cone("Android armoured torso", (0, 0.02, 0.43), 0.25, 0.18, 0.31, materials["Ceramic"])
    add_box("Rear power pack", (0, 0.22, 0.43), (0.3, 0.14, 0.27), materials["StructureDark"])
    add_box("Power pack cells", (0, 0.3, 0.44), (0.18, 0.02, 0.1), materials["Energy"], 0.006)
    add_sphere("Sensor head", (0, -0.05, 0.66), (0.2, 0.17, 0.15), materials["StructureDark"])
    add_sphere("Primary optic", (0, -0.205, 0.66), (0.085, 0.026, 0.085), materials["FactionAccent"])
    add_sphere("Secondary optic", (-0.11, -0.17, 0.66), (0.03, 0.018, 0.03), materials["FactionAccent"])
    add_sphere("Secondary optic", (0.11, -0.17, 0.66), (0.03, 0.018, 0.03), materials["FactionAccent"])


def build_charger(materials: dict[str, bpy.types.Material]) -> None:
    add_piece_base(materials)
    add_cylinder("Induction pad", (0, -0.05, 0.15), 0.27, 0.09, materials["StructureDark"])
    add_torus("Charging ring", (0, -0.05, 0.205), 0.19, 0.025, materials["Energy"])
    add_cylinder("Reactor column", (0, 0.22, 0.42), 0.14, 0.57, materials["StructureLight"])
    add_cylinder("Reactor core", (0, 0.22, 0.43), 0.08, 0.59, materials["FactionAccent"])
    add_torus("Reactor collar", (0, 0.22, 0.58), 0.13, 0.025, materials["Energy"])
    for x in (-0.29, 0.29):
        add_box("Docking arm", (x, 0.01, 0.39), (0.1, 0.17, 0.42), materials["Ceramic"], rotation=(0, 0.18 if x < 0 else -0.18, 0))
        add_box("Docking emitter", (x, -0.07, 0.55), (0.12, 0.08, 0.1), materials["FactionAccent"], 0.01)


def build_depot(materials: dict[str, bpy.types.Material]) -> None:
    add_piece_base(materials)
    add_box("Depot chassis", (0, 0.04, 0.25), (0.75, 0.64, 0.26), materials["StructureDark"])
    add_box("Sealed cargo pod", (-0.17, 0.08, 0.5), (0.34, 0.44, 0.32), materials["Ceramic"])
    add_box("Cargo pod stripe", (-0.17, -0.15, 0.5), (0.22, 0.018, 0.12), materials["FactionAccent"], 0.005)
    add_box("Utility pod", (0.24, 0.1, 0.43), (0.22, 0.34, 0.28), materials["StructureLight"])
    add_cylinder("Inventory mast", (0.28, 0.2, 0.7), 0.035, 0.42, materials["StructureDark"])
    add_sphere("Inventory beacon", (0.28, 0.2, 0.92), (0.07, 0.07, 0.07), materials["FactionAccent"])
    for x in (-0.28, 0.04, 0.31):
        add_box("Cargo clamp", (x, -0.3, 0.27), (0.08, 0.06, 0.15), materials["Energy"], 0.01)


def build_extractor(materials: dict[str, bpy.types.Material]) -> None:
    add_piece_base(materials)
    add_cylinder("Drill collar", (-0.12, -0.05, 0.2), 0.25, 0.15, materials["StructureLight"])
    add_torus("Drill warning ring", (-0.12, -0.05, 0.28), 0.2, 0.028, materials["ResourceOre"])
    add_cone("Ore drill", (-0.12, -0.05, 0.42), 0.16, 0.045, 0.38, materials["StructureDark"])
    add_cone("Drill bit", (-0.12, -0.05, 0.64), 0.06, 0.01, 0.17, materials["ResourceOre"])
    add_box("Extraction boom", (0.15, 0.11, 0.48), (0.48, 0.13, 0.12), materials["Ceramic"], rotation=(0, 0.22, 0))
    add_cylinder("Ore hopper", (0.26, 0.23, 0.32), 0.13, 0.34, materials["StructureDark"])
    add_box("Ore chute", (0.26, -0.02, 0.28), (0.12, 0.32, 0.12), materials["ResourceOre"], 0.01)
    for x in (-0.34, 0.34):
        add_box("Outrigger", (x, 0.2, 0.19), (0.14, 0.26, 0.12), materials["StructureDark"], rotation=(0, 0, 0.35 if x < 0 else -0.35))


def build_processor(materials: dict[str, bpy.types.Material]) -> None:
    add_piece_base(materials)
    add_cylinder("Refinery pressure vessel", (-0.13, 0.04, 0.4), 0.22, 0.57, materials["Ceramic"])
    add_torus("Refinery heat band", (-0.13, 0.04, 0.43), 0.22, 0.025, materials["Energy"])
    add_box("Furnace housing", (0.24, 0.05, 0.35), (0.31, 0.42, 0.45), materials["StructureDark"])
    add_box("Molten output", (0.24, -0.17, 0.37), (0.18, 0.018, 0.16), materials["Energy"], 0.005)
    for x in (-0.22, 0.17):
        add_cylinder("Refinery stack", (x, 0.17, 0.75), 0.07, 0.38, materials["StructureDark"])
        add_cone("Stack crown", (x, 0.17, 0.97), 0.1, 0.065, 0.08, materials["Ceramic"])
    add_cylinder("Ore inlet", (-0.34, -0.15, 0.3), 0.09, 0.25, materials["ResourceOre"], rotation=(pi / 2, 0, 0))


def build_acid_processing_plant(materials: dict[str, bpy.types.Material]) -> None:
    add_piece_base(materials)
    add_cylinder("Primary containment tank", (-0.15, 0.05, 0.42), 0.22, 0.58, materials["StructureLight"])
    add_cylinder("Acid core", (-0.15, 0.05, 0.43), 0.12, 0.6, materials["HazardAcid"])
    add_torus("Containment collar", (-0.15, 0.05, 0.61), 0.21, 0.025, materials["Ceramic"])
    add_box("Neutralisation rig", (0.23, 0.02, 0.34), (0.32, 0.44, 0.42), materials["StructureDark"])
    add_box("Acid monitor", (0.23, -0.21, 0.37), (0.16, 0.018, 0.17), materials["HazardAcid"], 0.006)
    add_cylinder("Transfer canister", (0.27, 0.18, 0.68), 0.065, 0.33, materials["HazardAcid"])
    add_torus("Waste pipe", (0.14, -0.17, 0.34), 0.13, 0.032, materials["HazardAcid"], rotation=(pi / 2, 0, 0))


def build_relay_tower(materials: dict[str, bpy.types.Material]) -> None:
    add_piece_base(materials)
    for x, y in ((-0.18, 0.1), (0.18, 0.1), (0, -0.2)):
        add_cone("Relay support", (x, y, 0.43), 0.09, 0.025, 0.65, materials["StructureLight"])
    add_cylinder("Relay mast", (0, 0, 0.72), 0.05, 0.82, materials["StructureDark"])
    add_cone("Directional relay dish", (0, -0.08, 0.83), 0.25, 0.08, 0.13, materials["Ceramic"], rotation=(pi / 2, 0, 0))
    add_torus("Dish signal ring", (0, -0.145, 0.83), 0.18, 0.018, materials["FactionAccent"], rotation=(pi / 2, 0, 0))
    add_sphere("Relay beacon", (0, 0, 1.15), (0.07, 0.07, 0.07), materials["FactionAccent"])


def build_scanner(materials: dict[str, bpy.types.Material]) -> None:
    add_piece_base(materials)
    add_cone("Scanner turret", (0, 0.05, 0.34), 0.22, 0.13, 0.42, materials["Ceramic"])
    add_cylinder("Scanner pivot", (0, -0.02, 0.58), 0.12, 0.16, materials["StructureDark"], rotation=(pi / 2, 0, 0))
    add_cone("Scanner dish", (0, -0.12, 0.62), 0.33, 0.1, 0.15, materials["StructureDark"], rotation=(pi / 2, 0, 0))
    add_torus("Scanner ring", (0, -0.2, 0.62), 0.23, 0.022, materials["FactionAccent"], rotation=(pi / 2, 0, 0))
    add_sphere("Scanner emitter", (0, -0.23, 0.62), (0.09, 0.03, 0.09), materials["FactionAccent"])
    add_cylinder("Scanner antenna", (0, 0.06, 0.82), 0.025, 0.25, materials["Energy"])


def build_colony_module(materials: dict[str, bpy.types.Material]) -> None:
    add_piece_base(materials)
    add_box("Colony foundation", (0, 0.03, 0.2), (0.84, 0.72, 0.22), materials["StructureDark"])
    add_sphere("Faceted habitat dome", (-0.12, 0.03, 0.48), (0.34, 0.31, 0.33), materials["Ceramic"])
    add_torus("Habitat horizon band", (-0.12, 0.03, 0.47), 0.28, 0.025, materials["FactionAccent"])
    add_box("Airlock spine", (0.29, -0.13, 0.37), (0.24, 0.24, 0.31), materials["StructureLight"])
    add_box("Airlock door", (0.29, -0.26, 0.37), (0.12, 0.018, 0.16), materials["FactionAccent"], 0.005)
    add_box("Solar wing", (-0.38, 0.15, 0.38), (0.23, 0.46, 0.04), materials["FactionAccent"], 0.008, rotation=(0.12, 0, -0.24))
    add_cylinder("Colony beacon mast", (0.28, 0.2, 0.7), 0.035, 0.62, materials["StructureDark"])
    add_sphere("Colony beacon", (0.28, 0.2, 1.04), (0.075, 0.075, 0.075), materials["Energy"])


def build_material_cache(materials: dict[str, bpy.types.Material]) -> None:
    add_box("Metal supply case", (0, 0, 0.16), (0.52, 0.36, 0.26), materials["StructureLight"], 0.035)
    add_box("Reinforced case lid", (0, 0, 0.305), (0.55, 0.39, 0.06), materials["StructureDark"], 0.018)
    add_box("Resource signal panel", (0, -0.187, 0.17), (0.24, 0.014, 0.1), materials["FactionAccent"], 0.006)
    for x in (-0.19, 0.19):
        add_box("Case corner guard", (x, -0.2, 0.15), (0.06, 0.04, 0.18), materials["StructureDark"], 0.01)
    add_box("Carry handle", (0, 0.21, 0.23), (0.2, 0.05, 0.06), materials["StructureDark"], 0.012)


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
    "colony-module": build_colony_module,
}


def select_objects(objects: list[bpy.types.Object]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for object in objects:
        object.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]


def point_at(object: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - object.location
    object.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_preview(piece_name: str, preview_dir: Path) -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(preview_dir / f"{piece_name}.png")
    scene.world.color = (0.003, 0.007, 0.018)

    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.01))
    floor = bpy.context.object
    floor.name = "Preview floor"
    floor.data.materials.append(bpy.data.materials["StructureDark"])

    bpy.ops.object.light_add(type="AREA", location=(2.5, -3.0, 4.0))
    key_light = bpy.context.object
    key_light.data.energy = 720
    key_light.data.shape = "DISK"
    key_light.data.size = 4
    point_at(key_light, (0, 0, 0.45))

    bpy.ops.object.light_add(type="AREA", location=(-3.0, 1.5, 2.0))
    fill_light = bpy.context.object
    fill_light.data.energy = 280
    fill_light.data.size = 3
    point_at(fill_light, (0, 0, 0.45))

    bpy.ops.object.light_add(type="AREA", location=(0, 2.5, 3.0))
    rim_light = bpy.context.object
    rim_light.data.energy = 420
    rim_light.data.size = 2
    rim_light.data.color = (0.2, 0.5, 1.0)
    point_at(rim_light, (0, 0, 0.5))

    bpy.ops.object.camera_add(location=(2.65, -3.3, 2.45))
    camera = bpy.context.object
    camera.data.lens = 60
    point_at(camera, (0, 0, 0.48))
    scene.camera = camera
    bpy.ops.render.render(write_still=True)


def export_piece(
    piece_name: str,
    materials: dict[str, bpy.types.Material],
    output_dir: Path,
    preview_dir: Path,
    source_dir: Path,
) -> None:
    PIECE_BUILDERS[piece_name](materials)
    piece_objects = list(bpy.context.scene.objects)
    select_objects(piece_objects)
    bpy.ops.wm.save_as_mainfile(filepath=str(source_dir / f"{piece_name}.blend"))
    render_preview(piece_name, preview_dir)
    select_objects(piece_objects)
    bpy.ops.export_scene.gltf(
        filepath=str(output_dir / f"{piece_name}.glb"),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
    )
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def main() -> None:
    arguments = parse_arguments()
    arguments.output_dir.mkdir(parents=True, exist_ok=True)
    arguments.preview_dir.mkdir(parents=True, exist_ok=True)
    arguments.source_dir.mkdir(parents=True, exist_ok=True)
    clear_scene()
    materials = create_materials()
    pieces = arguments.only or list(PIECE_BUILDERS)
    for piece_name in pieces:
        export_piece(piece_name, materials, arguments.output_dir, arguments.preview_dir, arguments.source_dir)


if __name__ == "__main__":
    main()
