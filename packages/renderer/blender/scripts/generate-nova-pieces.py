"""Generate Project Nova's first low-poly tabletop piece set.

Run from the repository root:
  blender --background --python packages/renderer/blender/scripts/generate-nova-pieces.py

Pass arguments after `--` to limit the export or change its location:
  blender --background --python ... -- --only android charger --output-dir /tmp/nova-models

The script saves one editable source blend and one GLB for each game piece.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT_DIR = ROOT / "assets" / "models"
DEFAULT_PREVIEW_DIR = ROOT / "assets" / "previews"
DEFAULT_SOURCE_DIR = ROOT / "blender" / "source"

MATERIALS = {
    "StructureDark": (0.034, 0.051, 0.078, 1.0),
    "StructureLight": (0.292, 0.363, 0.455, 1.0),
    "FactionAccent": (0.039, 0.546, 0.835, 1.0),
    "Energy": (1.0, 0.48, 0.035, 1.0),
    "HazardAcid": (0.37, 0.8, 0.035, 1.0),
    "ResourceOre": (0.95, 0.28, 0.055, 1.0),
    "Warning": (1.0, 0.13, 0.21, 1.0),
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
        principled.inputs["Metallic"].default_value = 0.35 if "Structure" in name else 0.1
        principled.inputs["Roughness"].default_value = 0.56
        if name in {"FactionAccent", "Energy", "HazardAcid"}:
            principled.inputs["Emission Color"].default_value = colour
            principled.inputs["Emission Strength"].default_value = 0.12
        materials[name] = material
    return materials


def add_box(name: str, location: tuple[float, float, float], scale: tuple[float, float, float], material: bpy.types.Material, bevel: float = 0.025) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location)
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


def add_cylinder(name: str, location: tuple[float, float, float], radius: float, depth: float, material: bpy.types.Material, vertices: int = 8) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    object = bpy.context.object
    object.name = name
    object.data.materials.append(material)
    return object


def add_cone(name: str, location: tuple[float, float, float], radius_1: float, radius_2: float, depth: float, material: bpy.types.Material) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=radius_1, radius2=radius_2, depth=depth, location=location)
    object = bpy.context.object
    object.name = name
    object.data.materials.append(material)
    return object


def add_sphere(name: str, location: tuple[float, float, float], scale: tuple[float, float, float], material: bpy.types.Material) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=4, location=location)
    object = bpy.context.object
    object.name = name
    object.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    object.data.materials.append(material)
    return object


def add_piece_base(materials: dict[str, bpy.types.Material]) -> None:
    add_cylinder("Tabletop plinth", (0, 0, 0.055), 0.43, 0.11, materials["StructureDark"])


def build_android(materials: dict[str, bpy.types.Material]) -> None:
    add_piece_base(materials)
    add_box("Android body", (0, -0.03, 0.39), (0.45, 0.34, 0.38), materials["StructureLight"])
    add_box("Android pack", (0, 0.22, 0.42), (0.32, 0.15, 0.3), materials["StructureDark"])
    add_box("Faction stripe", (0, -0.205, 0.43), (0.31, 0.025, 0.12), materials["FactionAccent"], 0.008)
    add_box("Left leg", (-0.16, 0.0, 0.2), (0.12, 0.14, 0.23), materials["StructureDark"])
    add_box("Right leg", (0.16, 0.0, 0.2), (0.12, 0.14, 0.23), materials["StructureDark"])
    add_sphere("Sensor head", (0, -0.09, 0.67), (0.19, 0.16, 0.16), materials["StructureDark"])
    add_sphere("Sensor lens", (0, -0.23, 0.67), (0.07, 0.025, 0.07), materials["FactionAccent"])


def build_charger(materials: dict[str, bpy.types.Material]) -> None:
    add_piece_base(materials)
    add_cylinder("Charging pad", (0, 0, 0.13), 0.28, 0.08, materials["Energy"])
    add_box("Gantry left", (-0.3, 0.08, 0.4), (0.11, 0.15, 0.58), materials["StructureLight"])
    add_box("Gantry right", (0.3, 0.08, 0.4), (0.11, 0.15, 0.58), materials["StructureLight"])
    add_box("Gantry bridge", (0, 0.08, 0.67), (0.7, 0.15, 0.13), materials["StructureDark"])
    add_box("Status panel", (0, -0.04, 0.66), (0.25, 0.025, 0.08), materials["FactionAccent"], 0.006)


def build_depot(materials: dict[str, bpy.types.Material]) -> None:
    add_piece_base(materials)
    add_box("Depot shell", (0, 0.03, 0.35), (0.72, 0.58, 0.48), materials["StructureLight"])
    add_box("Depot roof", (0, 0.03, 0.61), (0.78, 0.64, 0.08), materials["StructureDark"])
    add_box("Depot door", (0, -0.27, 0.34), (0.3, 0.025, 0.25), materials["FactionAccent"], 0.006)
    add_box("Cargo crate left", (-0.25, -0.3, 0.2), (0.16, 0.12, 0.14), materials["StructureDark"])
    add_box("Cargo crate right", (0.25, -0.3, 0.2), (0.16, 0.12, 0.14), materials["StructureDark"])


def build_extractor(materials: dict[str, bpy.types.Material]) -> None:
    add_piece_base(materials)
    add_cylinder("Extractor collar", (0, 0, 0.18), 0.28, 0.18, materials["StructureLight"])
    add_cone("Extractor drill", (0, 0, 0.4), 0.17, 0.055, 0.38, materials["ResourceOre"])
    for x, y in ((-0.28, -0.18), (0.28, -0.18), (-0.28, 0.18), (0.28, 0.18)):
        add_box("Extractor support", (x, y, 0.2), (0.11, 0.11, 0.23), materials["StructureDark"])
    add_box("Extractor readout", (0, -0.29, 0.28), (0.24, 0.025, 0.09), materials["ResourceOre"], 0.006)


def build_processor(materials: dict[str, bpy.types.Material]) -> None:
    add_piece_base(materials)
    add_box("Processor housing", (0, 0.03, 0.34), (0.65, 0.54, 0.43), materials["StructureLight"])
    add_box("Processor intake", (0, -0.27, 0.3), (0.3, 0.025, 0.16), materials["ResourceOre"], 0.006)
    for x in (-0.2, 0.2):
        add_cylinder("Processor stack", (x, 0.1, 0.68), 0.09, 0.38, materials["StructureDark"])
        add_cylinder("Stack cap", (x, 0.1, 0.89), 0.105, 0.05, materials["Energy"])


def build_acid_processing_plant(materials: dict[str, bpy.types.Material]) -> None:
    add_piece_base(materials)
    add_cylinder("Acid tank", (-0.12, 0.03, 0.4), 0.25, 0.57, materials["StructureLight"])
    add_cylinder("Acid indicator", (-0.12, -0.225, 0.44), 0.08, 0.025, materials["HazardAcid"])
    add_box("Processing unit", (0.26, 0.03, 0.32), (0.27, 0.4, 0.38), materials["StructureDark"])
    add_box("Hazard panel", (0.26, -0.18, 0.35), (0.14, 0.025, 0.14), materials["HazardAcid"], 0.006)
    add_cylinder("Outlet pipe", (0.16, 0.03, 0.62), 0.06, 0.36, materials["HazardAcid"])


def build_relay_tower(materials: dict[str, bpy.types.Material]) -> None:
    add_piece_base(materials)
    add_cone("Relay mast", (0, 0, 0.52), 0.18, 0.035, 0.82, materials["StructureLight"])
    add_sphere("Relay signal", (0, 0, 0.96), (0.11, 0.11, 0.11), materials["FactionAccent"])
    add_box("Relay dish", (0, -0.1, 0.73), (0.42, 0.08, 0.2), materials["StructureDark"])


def build_scanner(materials: dict[str, bpy.types.Material]) -> None:
    add_piece_base(materials)
    add_cylinder("Scanner pedestal", (0, 0, 0.3), 0.17, 0.43, materials["StructureLight"])
    add_sphere("Scanner dish", (0, 0, 0.58), (0.36, 0.36, 0.1), materials["StructureDark"])
    add_sphere("Scanner lens", (0, -0.29, 0.58), (0.09, 0.025, 0.09), materials["FactionAccent"])
    add_cylinder("Scanner antenna", (0, 0, 0.79), 0.025, 0.24, materials["FactionAccent"])


def build_colony_module(materials: dict[str, bpy.types.Material]) -> None:
    add_piece_base(materials)
    add_box("Colony foundation", (0, 0.04, 0.2), (0.82, 0.7, 0.23), materials["StructureDark"])
    add_sphere("Colony habitat", (-0.12, 0.03, 0.45), (0.36, 0.32, 0.3), materials["StructureLight"])
    add_box("Colony airlock", (0.27, -0.2, 0.34), (0.22, 0.18, 0.3), materials["FactionAccent"])
    add_cylinder("Colony beacon", (0.27, 0.18, 0.63), 0.035, 0.55, materials["StructureDark"])
    add_sphere("Colony beacon light", (0.27, 0.18, 0.92), (0.075, 0.075, 0.075), materials["Energy"])


PIECE_BUILDERS = {
    "android": build_android,
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
    scene.world.color = (0.004, 0.008, 0.02)

    bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.01))
    floor = bpy.context.object
    floor.name = "Preview floor"
    floor.data.materials.append(bpy.data.materials["StructureDark"])

    bpy.ops.object.light_add(type="AREA", location=(2.5, -3.0, 4.0))
    key_light = bpy.context.object
    key_light.data.energy = 650
    key_light.data.shape = "DISK"
    key_light.data.size = 4
    point_at(key_light, (0, 0, 0.35))

    bpy.ops.object.light_add(type="AREA", location=(-3.0, 1.5, 2.0))
    fill_light = bpy.context.object
    fill_light.data.energy = 350
    fill_light.data.size = 3
    point_at(fill_light, (0, 0, 0.35))

    bpy.ops.object.camera_add(location=(2.6, -3.2, 2.35))
    camera = bpy.context.object
    camera.data.lens = 58
    point_at(camera, (0, 0, 0.43))
    scene.camera = camera
    bpy.ops.render.render(write_still=True)


def export_piece(piece_name: str, materials: dict[str, bpy.types.Material], output_dir: Path, preview_dir: Path, source_dir: Path) -> None:
    PIECE_BUILDERS[piece_name](materials)
    piece_objects = list(bpy.context.scene.objects)
    select_objects(piece_objects)
    bpy.ops.wm.save_as_mainfile(filepath=str(source_dir / f"{piece_name}.blend"))
    render_preview(piece_name, preview_dir)
    select_objects(piece_objects)
    bpy.ops.export_scene.gltf(filepath=str(output_dir / f"{piece_name}.glb"), export_format="GLB", use_selection=True, export_apply=True)
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
