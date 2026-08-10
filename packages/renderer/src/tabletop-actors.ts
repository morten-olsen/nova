import type { World } from '@morten-olsen/nova-game/browser';
import * as THREE from 'three';

import { getFaction, getMaterialAccent, novaPalette, toColorValue } from './nova-palette.js';
import {
  createPlaceholder,
  getBuildingKind,
  getLoadedPieceModel,
  loadPieceModel,
  setOwnerColor,
} from './tabletop-assets.js';
import { createPieceLayouts, getTileKey, type PieceKind, type PieceLayout } from './tabletop-layout.js';
import { terrainSurfaceHeight } from './tabletop-board.js';
import type { ParticleEmitter } from './tabletop-particles.js';

type RenderPiece = {
  accentColor: THREE.Color;
  constructionTicks: number;
  id: string;
  kind: PieceKind;
  lowBattery: boolean;
};

type Actor = {
  accents: THREE.MeshStandardMaterial[];
  construction: boolean;
  constructionRing: THREE.Mesh | undefined;
  kind: PieceKind;
  leaving: boolean;
  lowBattery: boolean;
  opacity: number;
  phase: number;
  root: THREE.Group;
  /** 0 → 1 entrance progress. Drives the overshoot, not an exponential lerp. */
  spawn: number;
  target: THREE.Vector3;
  targetOpacity: number;
  targetScale: number;
  targetYaw: number;
  /** Eased selection lift, so picking a piece reads as it being raised. */
  lift: number;
  /** Smoothed travel speed, used to lean the piece into its movement. */
  travel: number;
};

type PuffRequest = { color: THREE.Color; position: THREE.Vector3 };

/** Battery below this pulses the owner accent toward warning. */
const lowBatteryThreshold = 25;
const spawnDuration = 0.42;

/** Overshoot easing. A plain lerp arrives with no weight; this lands. */
const easeOutBack = (t: number): number => {
  const overshoot = 1.9;
  const inverted = t - 1;
  return 1 + (overshoot + 1) * inverted ** 3 + overshoot * inverted ** 2;
};

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

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
        accentColor: new THREE.Color(toColorValue(getMaterialAccent(materials))),
        constructionTicks: 0,
        id: `material:${getTileKey(tile.position.x, tile.position.y)}`,
        kind: 'material-cache',
        lowBattery: false,
      },
    ];
  });
  return [
    ...world.androids.map((android) => ({
      accentColor: new THREE.Color(toColorValue(getFaction(world, android.ownerId).accent)),
      constructionTicks: 0,
      id: android.id,
      kind: 'android' as const,
      lowBattery: android.active && android.battery < lowBatteryThreshold,
    })),
    ...world.buildings.map((building) => ({
      accentColor: new THREE.Color(toColorValue(getFaction(world, building.ownerId).accent)),
      constructionTicks: building.remainingConstruction.ticks,
      id: building.id,
      kind: getBuildingKind(building),
      lowBattery: false,
    })),
    ...looseMaterials,
  ];
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

/** A slowly turning warning ring marks a site that is still being built. */
const createConstructionRing = (): THREE.Mesh => {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.018, 4, 20),
    new THREE.MeshBasicMaterial({
      color: toColorValue(novaPalette.energy),
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  return ring;
};

const createActor = (piece: RenderPiece, layout: PieceLayout): Actor => {
  const root = new THREE.Group();
  // Lets a raycast hit on any child mesh resolve back to the game entity.
  root.userData.pieceId = piece.id;
  root.position.set(layout.x, terrainSurfaceHeight + 0.35, layout.z);
  root.scale.setScalar(0.01);
  const visual = new THREE.Group();
  visual.add(createPlaceholder(piece.kind));
  root.add(visual);

  const actor: Actor = {
    accents: [],
    construction: piece.constructionTicks > 0,
    constructionRing: undefined,
    kind: piece.kind,
    leaving: false,
    lowBattery: piece.lowBattery,
    opacity: 0,
    phase: (piece.id.length * 0.73) % (Math.PI * 2),
    root,
    lift: 0,
    spawn: 0,
    target: new THREE.Vector3(layout.x, terrainSurfaceHeight, layout.z),
    targetOpacity: 1,
    targetScale: (piece.constructionTicks > 0 ? 0.72 : 1) * layout.scale,
    targetYaw: 0,
    travel: 0,
  };

  const applyModel = (model: THREE.Group | undefined): void => {
    if (!model) {
      return;
    }
    const instance = model.clone(true);
    actor.accents = setOwnerColor(instance, piece.accentColor);
    visual.clear();
    visual.add(instance);
  };

  // Take the model now if it is already cached. Deferring to the promise costs a
  // microtask, and by then this frame has been drawn with the placeholder.
  const cached = getLoadedPieceModel(piece.kind);
  if (cached) {
    applyModel(cached);
  } else {
    void loadPieceModel(piece.kind).then(applyModel);
  }
  return actor;
};

type ActorUpdate = {
  actors: Map<string, Actor>;
  pieces: THREE.Group;
  world: World;
};

const applyConstructionRing = (actor: Actor): void => {
  if (actor.construction && !actor.constructionRing) {
    actor.constructionRing = createConstructionRing();
    actor.root.add(actor.constructionRing);
    return;
  }
  if (!actor.construction && actor.constructionRing) {
    actor.constructionRing.removeFromParent();
    actor.constructionRing.geometry.dispose();
    actor.constructionRing = undefined;
  }
};

const updateActors = ({ actors, pieces, world }: ActorUpdate): void => {
  const layouts = createPieceLayouts(world);
  const present = new Set<string>();
  for (const piece of getRenderPieces(world)) {
    const layout = layouts.get(piece.id);
    if (!layout) {
      continue;
    }
    present.add(piece.id);
    const existing = actors.get(piece.id);
    if (!existing) {
      const created = createActor(piece, layout);
      applyConstructionRing(created);
      actors.set(piece.id, created);
      pieces.add(created.root);
      continue;
    }
    existing.construction = piece.constructionTicks > 0;
    existing.lowBattery = piece.lowBattery;
    existing.leaving = false;
    existing.targetOpacity = 1;
    existing.target.set(layout.x, terrainSurfaceHeight, layout.z);
    existing.targetScale = (piece.constructionTicks > 0 ? 0.72 : 1) * layout.scale;
    applyConstructionRing(existing);
    const directionX = layout.x - existing.root.position.x;
    const directionZ = layout.z - existing.root.position.z;
    if (existing.kind === 'android' && directionX * directionX + directionZ * directionZ > 0.0025) {
      existing.targetYaw = Math.atan2(directionX, directionZ);
    }
  }
  for (const [id, actor] of actors) {
    if (!present.has(id)) {
      actor.leaving = true;
      actor.target.y = -0.3;
      actor.targetOpacity = 0;
      actor.targetScale = 0.01;
    }
  }
};

const animateAccents = (actor: Actor, elapsed: number): void => {
  if (!actor.accents.length) {
    return;
  }
  // Low battery pulses the accent's emissive rather than recolouring it, so the
  // owner's colour is never overwritten by a status read.
  const intensity = actor.lowBattery ? 0.5 + Math.sin(elapsed * 7) * 0.5 : 1;
  for (const accent of actor.accents) {
    accent.emissiveIntensity = actor.lowBattery ? 0.4 + intensity * 1.6 : 1;
  }
};

type ActorFrame = {
  actors: Map<string, Actor>;
  delta: number;
  elapsed: number;
  onPuff: (puff: PuffRequest) => void;
  pieces: THREE.Group;
  selectedId: string | undefined;
};

const animateActor = (actor: Actor, frame: ActorFrame, id: string): void => {
  const { delta, elapsed, onPuff, pieces, actors } = frame;
  const previousX = actor.root.position.x;
  const previousZ = actor.root.position.z;
  const positionAlpha = 1 - Math.exp(-11 * delta);

  if (actor.spawn < 1 && !actor.leaving) {
    const landed = actor.spawn === 0;
    actor.spawn = Math.min(1, actor.spawn + delta / spawnDuration);
    actor.root.position.x = actor.target.x;
    actor.root.position.z = actor.target.z;
    actor.root.position.y = THREE.MathUtils.lerp(
      terrainSurfaceHeight + 0.35,
      actor.target.y,
      easeOutCubic(actor.spawn),
    );
    actor.root.scale.setScalar(actor.targetScale * easeOutBack(actor.spawn));
    actor.opacity = Math.min(1, actor.spawn * 1.8);
    if (landed) {
      actor.travel = 0;
    }
    if (actor.spawn >= 1) {
      onPuff({ color: new THREE.Color(toColorValue(novaPalette.structureLight)), position: actor.target.clone() });
    }
  } else {
    actor.root.position.lerp(actor.target, positionAlpha);
    const scaleAlpha = 1 - Math.exp(-13 * delta);
    actor.root.scale.setScalar(THREE.MathUtils.lerp(actor.root.scale.x, actor.targetScale, scaleAlpha));
    actor.opacity = THREE.MathUtils.lerp(actor.opacity, actor.targetOpacity, scaleAlpha);
  }

  setObjectOpacity(actor.root, actor.opacity);
  actor.root.rotation.y = THREE.MathUtils.lerp(actor.root.rotation.y, actor.targetYaw, positionAlpha);

  const travelled = Math.hypot(actor.root.position.x - previousX, actor.root.position.z - previousZ);
  const speed = delta > 0 ? travelled / delta : 0;
  actor.travel = THREE.MathUtils.lerp(actor.travel, speed, 1 - Math.exp(-8 * delta));

  actor.lift = THREE.MathUtils.lerp(actor.lift, id === frame.selectedId ? 0.07 : 0, 1 - Math.exp(-12 * delta));
  const visual = actor.root.children[0];
  if (visual) {
    const bob =
      actor.kind === 'android'
        ? Math.sin(elapsed * 5 + actor.phase) * 0.008 +
          Math.sin(elapsed * 12 + actor.phase) * Math.min(0.02, actor.travel * 0.02)
        : 0;
    if (actor.kind === 'android') {
      // Lean into travel so movement has a direction beyond the yaw.
      visual.rotation.x = Math.min(0.28, actor.travel * 0.16);
    }
    visual.position.y = bob + actor.lift;
  }
  if (actor.constructionRing) {
    actor.constructionRing.rotation.z = elapsed * 0.9;
  }
  animateAccents(actor, elapsed);

  if (actor.leaving && actor.root.scale.x < 0.03 && actor.opacity < 0.03) {
    onPuff({ color: new THREE.Color(toColorValue(novaPalette.structureDark)), position: actor.target.clone() });
    pieces.remove(actor.root);
    actors.delete(id);
  }
};

const animateActors = (frame: ActorFrame): void => {
  for (const [id, actor] of frame.actors) {
    animateActor(actor, frame, id);
  }
};

const getConstructionEmitters = (actors: Map<string, Actor>): ParticleEmitter[] => {
  const color = new THREE.Color(toColorValue(novaPalette.energy));
  return [...actors.entries()].flatMap(([id, actor]): ParticleEmitter[] => {
    if (!actor.construction || actor.leaving) {
      return [];
    }
    return [
      {
        id,
        color,
        rate: 16,
        position: new THREE.Vector3(
          actor.root.position.x,
          actor.root.position.y + 0.22 + actor.root.scale.y * 0.32,
          actor.root.position.z,
        ),
      },
    ];
  });
};

export type { Actor, PuffRequest };
export { animateActors, getConstructionEmitters, updateActors };
