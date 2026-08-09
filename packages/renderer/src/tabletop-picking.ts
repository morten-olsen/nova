import * as THREE from 'three';

type TileClickEvent = {
  position: { x: number; y: number };
};

type TileResolver = (point: THREE.Vector3) => TileClickEvent['position'] | undefined;

type TilePickerOptions = {
  board: THREE.Group;
  camera: THREE.PerspectiveCamera;
  canvas: HTMLCanvasElement;
  onTileClick?: (event: TileClickEvent) => void;
  resolveTile: TileResolver;
};

const createTilePicker = ({ board, camera, canvas, onTileClick, resolveTile }: TilePickerOptions): (() => void) => {
  if (!onTileClick) {
    return (): void => undefined;
  }
  const pointerDown = new THREE.Vector2();
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const onPointerDown = (event: PointerEvent): void => {
    pointerDown.set(event.clientX, event.clientY);
  };
  const onPointerUp = (event: PointerEvent): void => {
    if (pointerDown.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 5) {
      return;
    }
    const bounds = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(board.children, false)[0];
    const position = hit ? resolveTile(hit.point) : undefined;
    if (position) {
      onTileClick({ position });
    }
  };
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  return (): void => {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointerup', onPointerUp);
  };
};

export type { TileClickEvent };
export { createTilePicker };
