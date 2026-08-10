import type { World } from '@morten-olsen/nova-game/browser';
import * as THREE from 'three';

import { novaPalette, toColorValue } from './nova-palette.js';
import { fbm } from './tabletop-noise.js';
import { createFogPainter, hasFogData } from './tabletop-fog.js';
import { paintHazards } from './tabletop-hazards.js';
import { paintTerrain } from './tabletop-terrain.js';
import { getBounds, isSameBounds, pixelsPerTile, type BoardBounds, type TilePosition } from './tabletop-bounds.js';

type BoardUpdaterOptions = {
  /**
   * Whether this recording uses fog of war. Left undefined, the board falls back
   * to inspecting the current world, which cannot tell "nothing explored yet"
   * apart from "this recording has no fog data".
   */
  fogOfWar?: boolean;
};

type BoardUpdater = {
  animate: (elapsed: number, delta: number) => void;
  pickTile: (point: THREE.Vector3) => TilePosition | undefined;
  update: (world: World) => void;
};

/** Width of the graphite frame around the play area, in tile units. */
const rimWidth = 0.34;
const rimHeight = 0.085;
/**
 * Ground plane, and the layers stacked on it. All three share the same displaced
 * geometry so hazards and fog follow the terrain's relief instead of being
 * clipped by it.
 */
const terrainHeight = 0.038;
const hazardOffset = 0.008;
const fogOffset = 0.016;
const bodyThickness = 0.2;
/** Where a piece's plinth rests. Sits on the terrain rather than floating over it. */
const terrainSurfaceHeight = terrainHeight + 0.002;
/** Hazards animate; the terrain beneath them does not. 20Hz is plenty for liquid. */
const hazardFrameInterval = 1 / 20;

type LayerCanvas = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
};

const createLayerCanvas = (): LayerCanvas => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to create a board layer canvas');
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { canvas, context, texture };
};

const resizeLayer = (layer: LayerCanvas, bounds: BoardBounds): void => {
  layer.canvas.width = bounds.width * pixelsPerTile;
  layer.canvas.height = bounds.height * pixelsPerTile;
};

/**
 * Gentle coherent relief. The previous per-vertex hash produced white noise,
 * which computeVertexNormals turned into a permanently agitated surface.
 */
const createGroundGeometry = (bounds: BoardBounds): THREE.PlaneGeometry => {
  const segmentsPerTile = 6;
  const geometry = new THREE.PlaneGeometry(
    bounds.width,
    bounds.height,
    bounds.width * segmentsPerTile,
    bounds.height * segmentsPerTile,
  );
  const positions = geometry.getAttribute('position');
  if (!positions) {
    throw new Error('Ground geometry is missing positions');
  }
  const centreX = (bounds.minX + bounds.maxX) / 2;
  const centreY = (bounds.minY + bounds.maxY) / 2;
  for (let index = 0; index < positions.count; index += 1) {
    const worldX = positions.getX(index) + centreX;
    const worldY = -positions.getY(index) + centreY;
    const relief = (fbm(worldX * 0.5, worldY * 0.5, 11, 3) - 0.5) * 0.044;
    const detail = (fbm(worldX * 2.4, worldY * 2.4, 37, 2) - 0.5) * 0.011;
    positions.setZ(index, relief + detail);
  }
  geometry.computeVertexNormals();
  return geometry;
};

/**
 * The frame, as a single bevelled extrusion. The chamfer is what makes the board
 * read as a machined object rather than a plane floating in the void.
 */
const createRimGeometry = (bounds: BoardBounds): THREE.ExtrudeGeometry => {
  const halfWidth = bounds.width / 2;
  const halfHeight = bounds.height / 2;
  const outerX = halfWidth + rimWidth;
  const outerY = halfHeight + rimWidth;
  const shape = new THREE.Shape();
  shape.moveTo(-outerX, -outerY);
  shape.lineTo(outerX, -outerY);
  shape.lineTo(outerX, outerY);
  shape.lineTo(-outerX, outerY);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-halfWidth, -halfHeight);
  hole.lineTo(-halfWidth, halfHeight);
  hole.lineTo(halfWidth, halfHeight);
  hole.lineTo(halfWidth, -halfHeight);
  hole.closePath();
  shape.holes.push(hole);
  return new THREE.ExtrudeGeometry(shape, {
    depth: rimHeight,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.014,
    bevelSegments: 1,
    curveSegments: 1,
  });
};

/** A soft contact shadow so the board sits on something instead of hovering. */
const createContactShadow = (bounds: BoardBounds): THREE.Mesh => {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size * 0.5);
    gradient.addColorStop(0, 'rgb(0 0 0 / 0.55)');
    gradient.addColorStop(0.6, 'rgb(0 0 0 / 0.22)');
    gradient.addColorStop(1, 'rgb(0 0 0 / 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry((bounds.width + rimWidth * 2) * 1.9, (bounds.height + rimWidth * 2) * 1.9),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -bodyThickness - 0.01;
  return mesh;
};

type BoardMaterials = {
  body: THREE.Material;
  fog: THREE.Material;
  hazard: THREE.Material;
  rim: THREE.Material;
  terrain: THREE.Material;
};

const createBoardMaterials = (terrain: THREE.Texture, hazard: THREE.Texture, fog: THREE.Texture): BoardMaterials => ({
  terrain: new THREE.MeshStandardMaterial({ map: terrain, roughness: 0.93, metalness: 0.05 }),
  hazard: new THREE.MeshStandardMaterial({
    map: hazard,
    transparent: true,
    roughness: 0.35,
    metalness: 0.1,
    depthWrite: false,
  }),
  // Unlit: fog is an absence of information, not a lit surface.
  fog: new THREE.MeshBasicMaterial({ map: fog, transparent: true, depthWrite: false, toneMapped: false }),
  body: new THREE.MeshStandardMaterial({ color: toColorValue(novaPalette.void), roughness: 0.7, metalness: 0.35 }),
  rim: new THREE.MeshStandardMaterial({
    color: toColorValue(novaPalette.structureDark),
    roughness: 0.48,
    metalness: 0.65,
  }),
});

type BoardMeshes = {
  ground: THREE.PlaneGeometry;
  meshes: THREE.Mesh[];
};

const addGroundLayer = (
  ground: THREE.PlaneGeometry,
  material: THREE.Material,
  centre: TilePosition,
  height: number,
): THREE.Mesh => {
  const mesh = new THREE.Mesh(ground, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(centre.x, height, centre.y);
  return mesh;
};

/**
 * Builds the board as a recessed graphite tray: a solid body, the displaced
 * ground with its hazard and fog layers stacked on the same geometry, and a
 * bevelled rim standing proud of them.
 */
const buildBoardMeshes = (bounds: BoardBounds, materials: BoardMaterials): BoardMeshes => {
  const centre = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
  const ground = createGroundGeometry(bounds);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(bounds.width + rimWidth * 2, bodyThickness, bounds.height + rimWidth * 2),
    materials.body,
  );
  body.position.set(centre.x, -bodyThickness / 2, centre.y);
  body.receiveShadow = true;

  const terrain = addGroundLayer(ground, materials.terrain, centre, terrainHeight);
  terrain.receiveShadow = true;
  const hazard = addGroundLayer(ground, materials.hazard, centre, terrainHeight + hazardOffset);
  const fog = addGroundLayer(ground, materials.fog, centre, terrainHeight + fogOffset);

  const rim = new THREE.Mesh(createRimGeometry(bounds), materials.rim);
  rim.rotation.x = -Math.PI / 2;
  rim.position.set(centre.x, rimHeight, centre.y);
  rim.castShadow = true;
  rim.receiveShadow = true;

  const shadow = createContactShadow(bounds);
  shadow.position.x = centre.x;
  shadow.position.z = centre.y;

  return { ground, meshes: [shadow, body, terrain, hazard, fog, rim] };
};

/** The ground geometry is shared across three meshes, so it is disposed once. */
const disposeBoardMeshes = (built: BoardMeshes | undefined): void => {
  if (!built) {
    return;
  }
  for (const mesh of built.meshes) {
    mesh.removeFromParent();
    if (mesh.geometry !== built.ground) {
      mesh.geometry.dispose();
    }
  }
  built.ground.dispose();
};

const createBoardUpdater = (board: THREE.Group, options: BoardUpdaterOptions = {}): BoardUpdater => {
  const terrainLayer = createLayerCanvas();
  const hazardLayer = createLayerCanvas();
  const hazardScratch = createLayerCanvas();
  const fogLayer = createLayerCanvas();
  const materials = createBoardMaterials(terrainLayer.texture, hazardLayer.texture, fogLayer.texture);
  const fogPainter = createFogPainter();
  let built: BoardMeshes | undefined;
  let bounds: BoardBounds | undefined;
  let currentWorld: World | undefined;
  let lastHazardFrame = Number.NEGATIVE_INFINITY;
  let tileKeys = new Set<string>();

  const rebuild = (nextBounds: BoardBounds): void => {
    disposeBoardMeshes(built);
    built = buildBoardMeshes(nextBounds, materials);
    board.add(...built.meshes);
  };

  const repaintHazards = (world: World, elapsed: number): void => {
    if (!bounds) {
      return;
    }
    paintHazards({ bounds, context: hazardLayer.context, elapsed, scratch: hazardScratch.context, world });
    hazardLayer.texture.needsUpdate = true;
  };

  const repaintFog = (world: World): void => {
    if (!bounds) {
      return;
    }
    fogPainter.paint({ bounds, context: fogLayer.context, world });
    fogLayer.texture.needsUpdate = true;
  };

  const update = (world: World): void => {
    const nextBounds = getBounds(world.tiles);
    if (!isSameBounds(bounds, nextBounds)) {
      bounds = nextBounds;
      for (const layer of [terrainLayer, hazardLayer, hazardScratch, fogLayer]) {
        resizeLayer(layer, nextBounds);
      }
      fogPainter.reset();
      rebuild(nextBounds);
    }
    currentWorld = world;
    // Terrain only changes with the board's shape, so it is painted here rather
    // than in the animation loop.
    paintTerrain({ bounds: nextBounds, context: terrainLayer.context, world });
    terrainLayer.texture.needsUpdate = true;
    fogPainter.setWorld(world, options.fogOfWar ?? hasFogData(world));
    repaintFog(world);
    repaintHazards(world, 0);
    tileKeys = new Set(world.tiles.map((tile) => `${tile.position.x}:${tile.position.y}`));
  };

  const animate = (elapsed: number, delta: number): void => {
    if (!currentWorld) {
      return;
    }
    if (fogPainter.advance(delta)) {
      repaintFog(currentWorld);
    }
    if (elapsed - lastHazardFrame < hazardFrameInterval) {
      return;
    }
    lastHazardFrame = elapsed;
    repaintHazards(currentWorld, elapsed);
  };

  const pickTile = (point: THREE.Vector3): TilePosition | undefined => {
    if (!bounds) {
      return undefined;
    }
    const position = {
      x: Math.floor(point.x - bounds.minX + 0.5) + bounds.minX,
      y: Math.floor(point.z - bounds.minY + 0.5) + bounds.minY,
    };
    return tileKeys.has(`${position.x}:${position.y}`) ? position : undefined;
  };

  return { animate, pickTile, update };
};

export type { BoardUpdater, BoardUpdaterOptions, TilePosition };
export { createBoardUpdater, terrainSurfaceHeight };
