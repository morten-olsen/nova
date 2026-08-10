import type { World } from '@morten-olsen/nova-game';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { novaPalette, toColorValue } from './nova-palette.js';
import { createBoardUpdater } from './tabletop-board.js';
import { animateActors, getConstructionEmitters, updateActors, type Actor } from './tabletop-actors.js';
import { createCameraController, type CameraController, type CameraMove } from './tabletop-camera.js';
import { createTileHighlights, type TileHighlights } from './tabletop-highlight.js';
import { createTilePicker, type TileClickEvent } from './tabletop-picking.js';
import { createConstructionParticles, type ParticleSystem } from './tabletop-particles.js';
import { createTabletopPostProcess, type TabletopPostProcess } from './tabletop-post-process.js';
import type { TilePosition } from './tabletop-bounds.js';

type TabletopRendererOptions = {
  /**
   * Drive the animation from an internal requestAnimationFrame loop. Defaults to
   * true for interactive viewing. Set false for frame-accurate offline capture
   * (Remotion and friends) and call `advance` once per output frame instead.
   */
  autoPlay?: boolean;
  /**
   * Whether this recording uses fog of war. Decide it from the whole recording:
   * a single frame cannot distinguish "nothing explored yet" from "no fog data".
   */
  fogOfWar?: boolean;
  onTileClick?: (event: TileClickEvent) => void;
  /** Seed for particle motion. Fixed by default so stepped renders reproduce. */
  particleSeed?: number;
};

type TabletopSelection = {
  /** Entity whose model should read as picked up, if any. */
  pieceId?: string;
  position?: TilePosition;
};

type CameraFraming = {
  /** Distance that frames the whole board, in tile units. */
  boardDistance: number;
  maximumDistance: number;
  minimumDistance: number;
};

type TabletopRenderer = {
  /**
   * Advances every animation by `deltaSeconds` and renders exactly one frame.
   *
   * Intended for offline capture: call it once per output frame with `1 / fps`.
   * Safe to call while `autoPlay` is on, though the two will compete.
   */
  advance: (deltaSeconds: number) => void;
  dispose: () => void;
  /** Current distance from the camera to its target, in tile units. */
  getCameraDistance: () => number;
  /** Distance limits and the whole-board distance, for building zoom controls. */
  getCameraFraming: () => CameraFraming;
  /** Eases the camera to centre a tile and/or change zoom. */
  moveCamera: (move: CameraMove) => void;
  /** Eases back to framing the whole board. */
  resetCamera: (duration?: number) => void;
  /** Drives the on-board reticle and the raised selected piece. */
  setSelection: (selection: TabletopSelection) => void;
  setWorld: (world: World) => void;
};

type AnimationLoop = {
  step: (delta: number) => void;
  stop: () => void;
};

type SceneObjects = {
  board: THREE.Group;
  camera: THREE.PerspectiveCamera;
  cameraController: CameraController;
  controls: OrbitControls;
  highlights: TileHighlights;
  keyLight: THREE.DirectionalLight;
  particles: ParticleSystem;
  pieces: THREE.Group;
  postProcess: TabletopPostProcess;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
};

const getWorldBounds = (world: World): { centerX: number; centerZ: number; span: number } => {
  const positions = world.tiles.map((tile) => tile.position);
  const minX = Math.min(0, ...positions.map((position) => position.x));
  const maxX = Math.max(0, ...positions.map((position) => position.x));
  const minZ = Math.min(0, ...positions.map((position) => position.y));
  const maxZ = Math.max(0, ...positions.map((position) => position.y));
  return {
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
    span: Math.max(maxX - minX + 1, maxZ - minZ + 1),
  };
};

const createLighting = (scene: THREE.Scene): THREE.DirectionalLight => {
  scene.add(new THREE.HemisphereLight(0xbcd0e0, 0x3a2e22, 2.1));
  const keyLight = new THREE.DirectionalLight(0xfff2dc, 4.2);
  keyLight.position.set(5, 10, 4);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.bias = -0.0002;
  keyLight.shadow.normalBias = 0.018;
  scene.add(keyLight, keyLight.target);
  // Cool rim from behind separates the warm ceramic hulls from the void.
  const rimLight = new THREE.DirectionalLight(0x5aa9ff, 1.5);
  rimLight.position.set(-5, 4.5, -4.5);
  scene.add(rimLight);
  // Faint bounce from the ground so plinths never read as pure black.
  const bounce = new THREE.DirectionalLight(0xffbe86, 0.35);
  bounce.position.set(0, -3, 1.5);
  scene.add(bounce);
  return keyLight;
};

const createScene = (host: HTMLElement): SceneObjects => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(toColorValue(novaPalette.void));
  scene.fog = new THREE.Fog(toColorValue(novaPalette.void), 10, 28);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.width = '100%';
  host.replaceChildren(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  // Rotation stays off: this is a tabletop read from one side, and free orbit
  // makes the fixed piece fronts read as wrong.
  controls.enableRotate = false;
  controls.enablePan = true;
  controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
  controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
  controls.touches.ONE = THREE.TOUCH.PAN;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;

  const postProcess = createTabletopPostProcess(renderer, scene, camera);
  const particles = createConstructionParticles(scene);
  const board = new THREE.Group();
  const pieces = new THREE.Group();
  scene.add(board, pieces);
  const highlights = createTileHighlights(board);
  const keyLight = createLighting(scene);
  const cameraController = createCameraController(camera, controls);
  return {
    board,
    camera,
    cameraController,
    controls,
    highlights,
    keyLight,
    particles,
    pieces,
    postProcess,
    renderer,
    scene,
  };
};

/**
 * Frames the board so it fills the viewport with a small margin, and aims the
 * shadow camera at the same extent.
 */
const frameCamera = (world: World, objects: SceneObjects): CameraFraming => {
  const bounds = getWorldBounds(world);
  const focus = new THREE.Vector3(bounds.centerX, 0, bounds.centerZ);
  objects.camera.position.set(bounds.centerX, bounds.span * 0.72 + 1.2, bounds.centerZ + bounds.span * 0.84 + 1.6);
  objects.controls.target.copy(focus);
  // Close enough to fill the frame with a couple of tiles, far enough to see the
  // whole board with margin.
  objects.controls.minDistance = Math.max(1.6, bounds.span * 0.14);
  objects.controls.maxDistance = Math.max(16, bounds.span * 3);
  if (objects.scene.fog instanceof THREE.Fog) {
    // Kept well beyond the board so the frame's far corners stay legible; the
    // fog is for depth against the void, not for dimming the play area.
    objects.scene.fog.near = bounds.span * 2.4;
    objects.scene.fog.far = bounds.span * 5 + 6;
  }
  objects.controls.update();
  objects.keyLight.position.set(
    bounds.centerX - bounds.span * 0.75,
    bounds.span * 0.85 + 4,
    bounds.centerZ + bounds.span * 0.85,
  );
  objects.keyLight.target.position.set(bounds.centerX, 0, bounds.centerZ);
  const shadowCamera = objects.keyLight.shadow.camera;
  const shadowSize = Math.max(6, bounds.span * 0.9);
  shadowCamera.left = -shadowSize;
  shadowCamera.right = shadowSize;
  shadowCamera.top = shadowSize;
  shadowCamera.bottom = -shadowSize;
  shadowCamera.near = 0.5;
  shadowCamera.far = bounds.span * 4.5;
  shadowCamera.updateProjectionMatrix();
  return {
    boardDistance: objects.camera.position.distanceTo(focus),
    maximumDistance: objects.controls.maxDistance,
    minimumDistance: objects.controls.minDistance,
  };
};

/** Longest step the easings stay stable over; also caps catch-up after a stall. */
const maximumDelta = 0.05;

type AnimationLoopOptions = {
  actors: Map<string, Actor>;
  animateBoard: (elapsed: number, delta: number) => void;
  autoPlay: boolean;
  objects: SceneObjects;
  selection: { pieceId: string | undefined };
};

const createAnimationLoop = ({
  actors,
  animateBoard,
  autoPlay,
  objects,
  selection,
}: AnimationLoopOptions): AnimationLoop => {
  const timer = new THREE.Timer();
  let animationFrame = 0;
  let elapsed = 0;
  let disposed = false;

  const step = (delta: number): void => {
    elapsed += delta;
    animateBoard(elapsed, delta);
    animateActors({
      actors,
      delta,
      elapsed,
      pieces: objects.pieces,
      selectedId: selection.pieceId,
      onPuff: ({ color, position }) => objects.particles.burst(position, color),
    });
    objects.particles.update(delta, getConstructionEmitters(actors));
    objects.highlights.animate(elapsed, delta);
    objects.cameraController.animate(delta);
    objects.controls.update();
    objects.postProcess.render(elapsed);
  };

  const animate = (timestamp?: number): void => {
    if (disposed) {
      return;
    }
    animationFrame = requestAnimationFrame(animate);
    timer.update(timestamp);
    // Clamped at both ends. The first frame seeds the timer from
    // performance.now() while later frames carry rAF timestamps measured from
    // navigation start, so an unclamped delta can be large and negative — which
    // inverts every `1 - exp(-k * delta)` easing and drives transforms to NaN.
    step(THREE.MathUtils.clamp(timer.getDelta(), 0, maximumDelta));
  };

  if (autoPlay) {
    animate();
  } else {
    // Produce one frame so a manually driven renderer is never blank.
    step(0);
  }

  return {
    step,
    stop: (): void => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      timer.dispose();
    },
  };
};

const resizeToHost = (host: HTMLElement, objects: SceneObjects): void => {
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

const createTabletopRenderer = (host: HTMLElement, options: TabletopRendererOptions = {}): TabletopRenderer => {
  const objects = createScene(host);
  const actors = new Map<string, Actor>();
  const selection: { pieceId: string | undefined } = { pieceId: undefined };
  const boardUpdater = createBoardUpdater(objects.board, { fogOfWar: options.fogOfWar });
  const loop = createAnimationLoop({
    actors,
    animateBoard: boardUpdater.animate,
    autoPlay: options.autoPlay ?? true,
    objects,
    selection,
  });
  const removeTilePicker = createTilePicker({
    board: objects.board,
    camera: objects.camera,
    canvas: objects.renderer.domElement,
    onTileClick: (event) => options.onTileClick?.(event),
    onTileHover: (position) => objects.highlights.setHover(position),
    pieces: objects.pieces,
    resolveTile: boardUpdater.pickTile,
  });
  const resize = (): void => resizeToHost(host, objects);
  let hasWorld = false;
  let boardDefinition = '';
  let currentWorld: World | undefined;
  let framing: CameraFraming = { boardDistance: 12, maximumDistance: 24, minimumDistance: 3 };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  return {
    setWorld: (world: World): void => {
      boardUpdater.update(world);
      updateActors({ actors, pieces: objects.pieces, world });
      currentWorld = world;
      const nextBoardDefinition = world.tiles.map((tile) => `${tile.position.x}:${tile.position.y}`).join('|');
      if (!hasWorld || nextBoardDefinition !== boardDefinition) {
        framing = frameCamera(world, objects);
        boardDefinition = nextBoardDefinition;
        hasWorld = true;
      }
    },
    advance: (deltaSeconds: number): void => loop.step(Math.max(0, deltaSeconds)),
    getCameraDistance: (): number => objects.cameraController.getDistance(),
    getCameraFraming: (): CameraFraming => framing,
    moveCamera: (move: CameraMove): void => objects.cameraController.move(move),
    resetCamera: (duration?: number): void => {
      if (!currentWorld) {
        return;
      }
      const bounds = getWorldBounds(currentWorld);
      objects.cameraController.move({
        distance: framing.boardDistance,
        duration,
        position: { x: bounds.centerX, y: bounds.centerZ },
      });
    },
    setSelection: (next: TabletopSelection): void => {
      selection.pieceId = next.pieceId;
      objects.highlights.setSelection(next.position);
    },
    dispose: (): void => {
      loop.stop();
      removeTilePicker();
      resizeObserver.disconnect();
      objects.highlights.dispose();
      objects.controls.dispose();
      objects.particles.dispose();
      objects.postProcess.dispose();
      objects.renderer.dispose();
      host.replaceChildren();
    },
  };
};

export type {
  CameraFraming,
  CameraMove,
  TabletopRenderer,
  TabletopRendererOptions,
  TabletopSelection,
  TileClickEvent,
  TilePosition,
};
export { createTabletopRenderer };
