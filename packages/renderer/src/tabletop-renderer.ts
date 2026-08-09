import type { MaterialBundle, World } from '@morten-olsen/nova-game/browser';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { createBoardUpdater } from './tabletop-board.js';
import { createPlaceholder, getBuildingKind, loadPieceModel, setOwnerColor } from './tabletop-assets.js';
import { createPieceLayouts, getTileKey, type PieceKind, type PieceLayout } from './tabletop-layout.js';
import { createTilePicker, type TileClickEvent } from './tabletop-picking.js';
import { createTabletopPostProcess, type TabletopPostProcess } from './tabletop-post-process.js';

type TabletopRendererOptions = {
  onTileClick?: (event: TileClickEvent) => void;
};

type TabletopRenderer = {
  setWorld: (world: World) => void;
  dispose: () => void;
};

type RenderPiece = {
  accentColor: THREE.Color;
  constructionTicks: number;
  id: string;
  kind: PieceKind;
};

type Actor = {
  kind: PieceKind;
  root: THREE.Group;
  visual: THREE.Group;
  target: THREE.Vector3;
  targetScale: number;
  targetYaw: number;
  leaving: boolean;
  opacity: number;
  phase: number;
  targetOpacity: number;
};

type SceneObjects = {
  board: THREE.Group;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  keyLight: THREE.DirectionalLight;
  pieces: THREE.Group;
  postProcess: TabletopPostProcess;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
};

const getPlayerColor = (ownerId: string): THREE.Color => {
  let value = 0;
  for (const character of ownerId) {
    value = (value * 31 + character.charCodeAt(0)) >>> 0;
  }
  const palette = [0x38bdf8, 0xf97316, 0xa3e635, 0xe879f9, 0xfacc15, 0x2dd4bf];
  return new THREE.Color(palette[value % palette.length] ?? 0x38bdf8);
};

const getLooseMaterialColor = (materials: MaterialBundle): THREE.Color => {
  if ((materials.acidCanister ?? 0) > 0) {
    return new THREE.Color(0xa3e635);
  }
  if ((materials.electronics ?? 0) > 0) {
    return new THREE.Color(0x38bdf8);
  }
  if ((materials.ore ?? 0) > 0) {
    return new THREE.Color(0xfb923c);
  }
  if ((materials.polymer ?? 0) > 0) {
    return new THREE.Color(0xe879f9);
  }
  return new THREE.Color(0x94a3b8);
};

const getRenderPieces = (world: World): RenderPiece[] => {
  const buildingTiles = new Set(
    world.buildings.map((building) => getTileKey(building.position.x, building.position.y)),
  );
  const looseMaterials = world.tiles.flatMap((tile): RenderPiece[] => {
    const materials = tile.scattered ?? {};
    if (
      buildingTiles.has(getTileKey(tile.position.x, tile.position.y)) ||
      !Object.values(materials).some((quantity) => quantity > 0)
    ) {
      return [];
    }
    return [
      {
        accentColor: getLooseMaterialColor(materials),
        constructionTicks: 0,
        id: `material:${getTileKey(tile.position.x, tile.position.y)}`,
        kind: 'material-cache',
      },
    ];
  });
  return [
    ...world.androids.map((android) => ({
      accentColor: getPlayerColor(android.ownerId),
      constructionTicks: 0,
      id: android.id,
      kind: 'android' as const,
    })),
    ...world.buildings.map((building) => ({
      accentColor: getPlayerColor(building.ownerId),
      constructionTicks: building.remainingConstruction.ticks,
      id: building.id,
      kind: getBuildingKind(building),
    })),
    ...looseMaterials,
  ];
};

const getWorldBounds = (world: World): { centerX: number; centerZ: number; span: number } => {
  const positions = world.tiles.map((tile) => tile.position);
  const minX = Math.min(0, ...positions.map((position) => position.x));
  const maxX = Math.max(0, ...positions.map((position) => position.x));
  const minZ = Math.min(0, ...positions.map((position) => position.y));
  const maxZ = Math.max(0, ...positions.map((position) => position.y));
  return { centerX: (minX + maxX) / 2, centerZ: (minZ + maxZ) / 2, span: Math.max(maxX - minX + 1, maxZ - minZ + 1) };
};

const setShadowFlags = (object: THREE.Object3D): void => {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
};

const setObjectOpacity = (object: THREE.Object3D, opacity: number): void => {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      material.opacity = opacity;
      material.transparent = opacity < 0.999;
      material.depthWrite = opacity > 0.95;
    }
  });
};

const createActor = (piece: RenderPiece, layout: PieceLayout): Actor => {
  const root = new THREE.Group();
  root.position.set(layout.x, 0.8, layout.z);
  root.scale.setScalar(0.05);

  const visual = createPlaceholder(piece.kind);
  root.add(visual);
  void loadPieceModel(piece.kind).then((model) => {
    const instance = model.clone(true);
    setOwnerColor(instance, piece.accentColor);
    setShadowFlags(instance);
    visual.clear();
    visual.add(instance);
  });

  return {
    kind: piece.kind,
    root,
    visual,
    target: new THREE.Vector3(layout.x, 0.105, layout.z),
    targetScale: (piece.constructionTicks > 0 ? 0.72 : 1) * layout.scale,
    targetYaw: 0,
    leaving: false,
    opacity: 0,
    phase: (piece.id.length * 0.73) % (Math.PI * 2),
    targetOpacity: 1,
  };
};

const createScene = (host: HTMLElement): SceneObjects => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050816);
  scene.fog = new THREE.Fog(0x050816, 10, 28);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.width = '100%';
  host.replaceChildren(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enableRotate = false;
  controls.enablePan = true;
  controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
  controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
  controls.touches.ONE = THREE.TOUCH.PAN;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = Math.PI / 2.15;

  const postProcess = createTabletopPostProcess(renderer, scene, camera);

  const board = new THREE.Group();
  const pieces = new THREE.Group();
  scene.add(board, pieces, new THREE.HemisphereLight(0xc9d7df, 0x241c17, 1.35));
  const keyLight = new THREE.DirectionalLight(0xfff1d6, 3.9);
  keyLight.position.set(5, 10, 4);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.bias = -0.0002;
  keyLight.shadow.normalBias = 0.018;
  keyLight.shadow.camera.left = -8;
  keyLight.shadow.camera.right = 8;
  keyLight.shadow.camera.top = 8;
  keyLight.shadow.camera.bottom = -8;
  scene.add(keyLight, keyLight.target);
  const rimLight = new THREE.DirectionalLight(0x4da3ff, 1.3);
  rimLight.position.set(-5, 5, -4);
  scene.add(rimLight);
  return { board, camera, controls, keyLight, pieces, postProcess, renderer, scene };
};

const updateActors = (world: World, pieces: THREE.Group, actors: Map<string, Actor>): void => {
  const layouts = createPieceLayouts(world);
  const nextPieces = new Set<string>();
  for (const piece of getRenderPieces(world)) {
    const layout = layouts.get(piece.id);
    if (!layout) {
      continue;
    }
    nextPieces.add(piece.id);
    const actor = actors.get(piece.id);
    if (!actor) {
      const created = createActor(piece, layout);
      actors.set(piece.id, created);
      pieces.add(created.root);
      continue;
    }
    actor.leaving = false;
    actor.targetOpacity = 1;
    actor.target.set(layout.x, 0.105, layout.z);
    actor.targetScale = (piece.constructionTicks > 0 ? 0.72 : 1) * layout.scale;
    const directionX = layout.x - actor.root.position.x;
    const directionZ = layout.z - actor.root.position.z;
    if (actor.kind === 'android' && directionX * directionX + directionZ * directionZ > 0.0025) {
      actor.targetYaw = Math.atan2(directionX, directionZ);
    }
  }
  for (const [id, actor] of actors) {
    if (!nextPieces.has(id)) {
      actor.leaving = true;
      actor.target.y = -0.35;
      actor.targetOpacity = 0;
      actor.targetScale = 0.01;
    }
  }
};

const frameCamera = (world: World, objects: SceneObjects): void => {
  const bounds = getWorldBounds(world);
  const focus = new THREE.Vector3(bounds.centerX, 0, bounds.centerZ);
  objects.camera.position.set(bounds.centerX, bounds.span * 0.78 + 1.5, bounds.centerZ + bounds.span * 1.02 + 2.5);
  objects.controls.target.copy(focus);
  objects.controls.minDistance = Math.max(3, bounds.span * 0.75);
  objects.controls.maxDistance = Math.max(16, bounds.span * 3);
  if (objects.scene.fog instanceof THREE.Fog) {
    objects.scene.fog.near = bounds.span * 1.4;
    objects.scene.fog.far = bounds.span * 3.6 + 2;
  }
  objects.controls.update();
  objects.keyLight.position.set(
    bounds.centerX - bounds.span * 0.8,
    bounds.span * 0.8 + 4,
    bounds.centerZ + bounds.span * 0.9,
  );
  objects.keyLight.target.position.set(bounds.centerX, 0, bounds.centerZ);
  const shadowCamera = objects.keyLight.shadow.camera;
  const shadowSize = Math.max(6, bounds.span * 0.85);
  shadowCamera.left = -shadowSize;
  shadowCamera.right = shadowSize;
  shadowCamera.top = shadowSize;
  shadowCamera.bottom = -shadowSize;
  shadowCamera.near = 0.5;
  shadowCamera.far = bounds.span * 4;
  shadowCamera.updateProjectionMatrix();
};

const createAnimationLoop = (objects: SceneObjects, actors: Map<string, Actor>): (() => void) => {
  const timer = new THREE.Timer();
  let animationFrame = 0;
  let elapsed = 0;
  let disposed = false;
  const animate = (timestamp?: number): void => {
    if (disposed) {
      return;
    }
    animationFrame = requestAnimationFrame(animate);
    timer.update(timestamp);
    const delta = Math.min(timer.getDelta(), 0.05);
    elapsed += delta;
    const positionAlpha = 1 - Math.exp(-10 * delta);
    const scaleAlpha = 1 - Math.exp(-12 * delta);
    for (const [id, actor] of actors) {
      actor.root.position.lerp(actor.target, positionAlpha);
      const nextScale = THREE.MathUtils.lerp(actor.root.scale.x, actor.targetScale, scaleAlpha);
      actor.root.scale.setScalar(nextScale);
      actor.opacity = THREE.MathUtils.lerp(actor.opacity, actor.targetOpacity, scaleAlpha);
      setObjectOpacity(actor.root, actor.opacity);
      actor.root.rotation.y = THREE.MathUtils.lerp(actor.root.rotation.y, actor.targetYaw, positionAlpha);
      actor.visual.position.y = actor.kind === 'android' ? Math.sin(elapsed * 5 + actor.phase) * 0.012 : 0;
      if (actor.leaving && nextScale < 0.025 && actor.opacity < 0.025) {
        objects.pieces.remove(actor.root);
        actors.delete(id);
      }
    }
    objects.controls.update();
    objects.postProcess.render(elapsed);
  };
  animate();
  return (): void => {
    disposed = true;
    cancelAnimationFrame(animationFrame);
    timer.dispose();
  };
};

const createTabletopRenderer = (host: HTMLElement, options: TabletopRendererOptions = {}): TabletopRenderer => {
  const objects = createScene(host);
  const actors = new Map<string, Actor>();
  const boardUpdater = createBoardUpdater(objects.board);
  const stopAnimation = createAnimationLoop(objects, actors);
  const removeTilePicker = createTilePicker({
    board: objects.board,
    camera: objects.camera,
    canvas: objects.renderer.domElement,
    onTileClick: options.onTileClick,
    resolveTile: boardUpdater.pickTile,
  });
  const resize = (): void => {
    if (!host.clientWidth || !host.clientHeight) {
      return;
    }
    objects.camera.aspect = host.clientWidth / host.clientHeight;
    objects.camera.updateProjectionMatrix();
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    objects.renderer.setPixelRatio(pixelRatio);
    objects.renderer.setSize(host.clientWidth, host.clientHeight, false);
    objects.postProcess.resize(host.clientWidth, host.clientHeight, pixelRatio);
  };
  let hasWorld = false;
  let boardDefinition = '';
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  return {
    setWorld: (world: World): void => {
      boardUpdater.update(world);
      updateActors(world, objects.pieces, actors);
      const nextBoardDefinition = world.tiles.map((tile) => `${tile.position.x}:${tile.position.y}`).join('|');
      if (!hasWorld || nextBoardDefinition !== boardDefinition) {
        frameCamera(world, objects);
        boardDefinition = nextBoardDefinition;
        hasWorld = true;
      }
    },
    dispose: (): void => {
      stopAnimation();
      removeTilePicker();
      resizeObserver.disconnect();
      objects.controls.dispose();
      objects.postProcess.dispose();
      objects.renderer.dispose();
      host.replaceChildren();
    },
  };
};

export type { TabletopRenderer, TabletopRendererOptions, TileClickEvent };
export { createTabletopRenderer };
