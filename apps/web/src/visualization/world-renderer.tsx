import type { World } from '@morten-olsen/nova-game/browser';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

type WorldRendererProps = {
  world: World;
};

type SceneObjects = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
};

const tileSize = 1;

const getWorldSize = (world: World): { width: number; height: number } => {
  const maxX = Math.max(0, ...world.tiles.map((tile) => tile.position.x));
  const maxY = Math.max(0, ...world.tiles.map((tile) => tile.position.y));
  return { width: maxX + 1, height: maxY + 1 };
};

const createScene = (host: HTMLDivElement, world: World): SceneObjects => {
  const { width, height } = getWorldSize(world);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, host.clientWidth / host.clientHeight, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true });

  scene.background = new THREE.Color(0x050816);
  camera.position.set(width / 2, Math.max(width, height) * 1.25, height * 1.6 + 2);
  camera.lookAt(width / 2, 0, height / 2);
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  host.append(renderer.domElement);

  return { scene, camera, renderer };
};

const createTileMesh = (acid: number, metal: number): THREE.Mesh => {
  const color = new THREE.Color(0x1f2937).lerp(new THREE.Color(0x16a34a), Math.min(1, metal / 20));
  color.lerp(new THREE.Color(0x84cc16), Math.min(0.5, acid / 20));

  return new THREE.Mesh(new THREE.BoxGeometry(tileSize, 0.08, tileSize), new THREE.MeshStandardMaterial({ color }));
};

const renderWorld = ({ scene, camera, renderer }: SceneObjects, world: World): void => {
  scene.clear();
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));

  const light = new THREE.DirectionalLight(0xffffff, 1.4);
  light.position.set(3, 8, 5);
  scene.add(light);

  for (const tile of world.tiles) {
    const mesh = createTileMesh(tile.composition.acid, tile.composition.metal);
    mesh.position.set(tile.position.x, 0, tile.position.y);
    scene.add(mesh);
  }

  for (const android of world.androids) {
    const mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.22, 0.45, 4, 8),
      new THREE.MeshStandardMaterial({ color: android.active ? 0x38bdf8 : 0x64748b }),
    );
    mesh.position.set(android.position.x, 0.45, android.position.y);
    scene.add(mesh);
  }

  for (const building of world.buildings) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.5, 0.6),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b }),
    );
    mesh.position.set(building.position.x, 0.3, building.position.y);
    scene.add(mesh);
  }

  renderer.render(scene, camera);
};

const WorldRenderer = ({ world }: WorldRendererProps): React.ReactNode => {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }

    const objects = createScene(host, world);
    renderWorld(objects, world);

    return () => {
      objects.renderer.dispose();
      host.replaceChildren();
    };
  }, [world]);

  return <div ref={hostRef} className="h-full min-h-125 w-full overflow-hidden rounded-2xl border border-slate-800" />;
};

export { WorldRenderer };
