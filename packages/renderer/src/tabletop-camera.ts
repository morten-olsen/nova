import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import type { TilePosition } from './tabletop-bounds.js';

type CameraMove = {
  /** Distance from the target, in tile units. Omitted keeps the current zoom. */
  distance?: number;
  /** Seconds to ease over. 0 snaps immediately. */
  duration?: number;
  /** Tile to centre on. Omitted keeps the current centre. */
  position?: TilePosition;
};

type CameraController = {
  /** Steps an in-flight move. Driven from the render loop, so capture is exact. */
  animate: (delta: number) => void;
  /** Current distance from the camera to its target, in tile units. */
  getDistance: () => number;
  move: (move: CameraMove) => void;
};

const defaultDuration = 0.9;

/** Ease-in-out: a camera move that starts and stops abruptly reads as a cut. */
const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Eased camera moves layered over OrbitControls.
 *
 * Only drives the camera while a move is in flight, so panning and scroll-zoom
 * keep working the rest of the time. Because it advances on the render loop's
 * delta rather than wall-clock time, a stepped offline render produces exactly
 * the same path as live playback.
 */
const createCameraController = (camera: THREE.PerspectiveCamera, controls: OrbitControls): CameraController => {
  const startTarget = new THREE.Vector3();
  const endTarget = new THREE.Vector3();
  // Captured once per move: rotation is disabled, so the view direction is fixed
  // and recomputing it from a moving camera would drift.
  const direction = new THREE.Vector3();
  let startDistance = 0;
  let endDistance = 0;
  let duration = 0;
  let elapsed = 0;
  let active = false;

  const getDistance = (): number => camera.position.distanceTo(controls.target);

  const apply = (progress: number): void => {
    const eased = easeInOutCubic(progress);
    controls.target.lerpVectors(startTarget, endTarget, eased);
    const distance = THREE.MathUtils.lerp(startDistance, endDistance, eased);
    camera.position.copy(controls.target).addScaledVector(direction, distance);
    controls.update();
  };

  const move = ({ distance, duration: seconds = defaultDuration, position }: CameraMove): void => {
    startTarget.copy(controls.target);
    endTarget.copy(controls.target);
    if (position) {
      endTarget.set(position.x, controls.target.y, position.y);
    }
    direction.subVectors(camera.position, controls.target).normalize();
    startDistance = getDistance();
    endDistance = THREE.MathUtils.clamp(distance ?? startDistance, controls.minDistance, controls.maxDistance);
    duration = Math.max(0, seconds);
    elapsed = 0;
    active = true;
    if (duration === 0) {
      apply(1);
      active = false;
    }
  };

  const animate = (delta: number): void => {
    if (!active) {
      return;
    }
    elapsed += delta;
    const progress = duration > 0 ? Math.min(1, elapsed / duration) : 1;
    apply(progress);
    if (progress >= 1) {
      active = false;
    }
  };

  return { animate, getDistance, move };
};

export type { CameraController, CameraMove };
export { createCameraController };
