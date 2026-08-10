import * as THREE from 'three';

import type { TilePosition } from './tabletop-bounds.js';

type TileClickEvent = {
  /**
   * The game entity whose model was clicked, when the click landed on a piece
   * rather than bare ground. Lets callers select an android or building directly.
   */
  pieceId?: string;
  position: TilePosition;
};

type TileResolver = (point: THREE.Vector3) => TilePosition | undefined;

type TilePickerOptions = {
  board: THREE.Group;
  camera: THREE.PerspectiveCamera;
  canvas: HTMLCanvasElement;
  onTileClick?: (event: TileClickEvent) => void;
  onTileHover?: (position: TilePosition | undefined) => void;
  pieces: THREE.Group;
  resolveTile: TileResolver;
};

/** Pointer travel beyond this is a camera drag, not a tile click. */
const dragThreshold = 5;

/** Walks up from a hit mesh to the actor root that carries the entity id. */
const findPieceId = (object: THREE.Object3D | null): string | undefined => {
  for (let current = object; current; current = current.parent) {
    const pieceId = current.userData.pieceId;
    if (typeof pieceId === 'string') {
      return pieceId;
    }
  }
  return undefined;
};

const createTilePicker = ({
  board,
  camera,
  canvas,
  onTileClick,
  onTileHover,
  pieces,
  resolveTile,
}: TilePickerOptions): (() => void) => {
  const pointerDown = new THREE.Vector2();
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();

  const resolveAt = (clientX: number, clientY: number): TileClickEvent | undefined => {
    const bounds = canvas.getBoundingClientRect();
    pointer.set(((clientX - bounds.left) / bounds.width) * 2 - 1, -((clientY - bounds.top) / bounds.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    // Pieces first: clicking a model should select that entity, and its tile is
    // still recoverable from where the ray meets the ground.
    const pieceHit = raycaster.intersectObjects(pieces.children, true)[0];
    const groundHit = raycaster.intersectObjects(board.children, false)[0];
    const position = groundHit ? resolveTile(groundHit.point) : undefined;
    if (pieceHit && (!groundHit || pieceHit.distance <= groundHit.distance)) {
      const pieceId = findPieceId(pieceHit.object);
      const piecePosition = position ?? {
        x: Math.round(pieceHit.object.getWorldPosition(new THREE.Vector3()).x),
        y: Math.round(pieceHit.object.getWorldPosition(new THREE.Vector3()).z),
      };
      return { pieceId, position: piecePosition };
    }
    return position ? { position } : undefined;
  };

  const onPointerDown = (event: PointerEvent): void => {
    pointerDown.set(event.clientX, event.clientY);
  };

  const onPointerMove = (event: PointerEvent): void => {
    const hit = resolveAt(event.clientX, event.clientY);
    // Cursor feedback is the cheapest possible signal that tiles are clickable.
    canvas.style.cursor = hit ? 'pointer' : 'default';
    onTileHover?.(hit?.position);
  };

  const onPointerLeave = (): void => {
    canvas.style.cursor = 'default';
    onTileHover?.(undefined);
  };

  const onPointerUp = (event: PointerEvent): void => {
    if (pointerDown.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > dragThreshold) {
      return;
    }
    const hit = resolveAt(event.clientX, event.clientY);
    if (hit) {
      onTileClick?.(hit);
    }
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  return (): void => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerleave', onPointerLeave);
  };
};

export type { TileClickEvent };
export { createTilePicker };
