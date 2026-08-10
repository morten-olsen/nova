import * as THREE from 'three';

import { novaPalette, toColorValue } from './nova-palette.js';
import type { TilePosition } from './tabletop-bounds.js';

type TileHighlights = {
  animate: (elapsed: number, delta: number) => void;
  dispose: () => void;
  setHover: (position: TilePosition | undefined) => void;
  setSelection: (position: TilePosition | undefined) => void;
};

type Reticle = {
  brackets: THREE.Group;
  fill: THREE.Mesh;
  fillMaterial: THREE.MeshBasicMaterial;
  material: THREE.MeshBasicMaterial;
  opacity: number;
  root: THREE.Group;
  targetOpacity: number;
};

/**
 * Sits just above the highest terrain relief so the reticle never sinks into a
 * rise, while staying low enough that pieces on the tile still occlude it.
 */
const highlightHeight = 0.075;

/**
 * Four corner brackets rather than a closed outline: the design language calls
 * for a thin tile marker that never obscures the piece, and an open reticle
 * reads as a command interface rather than a physical ring.
 */
const createBrackets = (material: THREE.MeshBasicMaterial): THREE.Group => {
  const group = new THREE.Group();
  const armLength = 0.28;
  const thickness = 0.032;
  const height = 0.014;
  const edge = 0.5;
  for (const signX of [-1, 1]) {
    for (const signZ of [-1, 1]) {
      const alongX = new THREE.Mesh(new THREE.BoxGeometry(armLength, height, thickness), material);
      alongX.position.set(signX * (edge - armLength / 2), 0, signZ * edge);
      const alongZ = new THREE.Mesh(new THREE.BoxGeometry(thickness, height, armLength), material);
      alongZ.position.set(signX * edge, 0, signZ * (edge - armLength / 2));
      group.add(alongX, alongZ);
    }
  }
  return group;
};

const createReticle = (colour: number, fillOpacity: number): Reticle => {
  const root = new THREE.Group();
  root.visible = false;
  const material = new THREE.MeshBasicMaterial({
    color: colour,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
  });
  const brackets = createBrackets(material);
  const fillMaterial = new THREE.MeshBasicMaterial({
    color: colour,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fillMaterial);
  fill.rotation.x = -Math.PI / 2;
  root.add(brackets, fill);
  root.userData.fillOpacity = fillOpacity;
  return { brackets, fill, fillMaterial, material, opacity: 0, root, targetOpacity: 0 };
};

const setReticleTile = (reticle: Reticle, position: TilePosition | undefined): void => {
  if (position) {
    reticle.root.position.set(position.x, highlightHeight, position.y);
    reticle.root.visible = true;
    reticle.targetOpacity = 1;
    return;
  }
  reticle.targetOpacity = 0;
};

const createTileHighlights = (parent: THREE.Object3D): TileHighlights => {
  const hover = createReticle(toColorValue(novaPalette.structureLight), 0.05);
  const selection = createReticle(toColorValue(novaPalette.system), 0.1);
  parent.add(hover.root, selection.root);

  const animateReticle = (reticle: Reticle, delta: number, pulse: number): void => {
    const alpha = 1 - Math.exp(-14 * delta);
    reticle.opacity = THREE.MathUtils.lerp(reticle.opacity, reticle.targetOpacity, alpha);
    if (reticle.opacity < 0.004) {
      reticle.root.visible = false;
      return;
    }
    const fillOpacity = Number(reticle.root.userData.fillOpacity ?? 0.05);
    reticle.material.opacity = reticle.opacity * pulse;
    reticle.fillMaterial.opacity = reticle.opacity * fillOpacity * pulse;
  };

  return {
    setHover: (position) => setReticleTile(hover, position),
    setSelection: (position) => setReticleTile(selection, position),
    animate: (elapsed, delta) => {
      animateReticle(hover, delta, 0.72);
      // The selected tile breathes so it stays distinguishable from hover even
      // when both land on the same tile.
      const pulse = 0.82 + Math.sin(elapsed * 3.1) * 0.18;
      animateReticle(selection, delta, pulse);
      selection.brackets.scale.setScalar(1 + Math.sin(elapsed * 3.1) * 0.014);
    },
    dispose: () => {
      for (const reticle of [hover, selection]) {
        reticle.root.removeFromParent();
        reticle.brackets.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
          }
        });
        reticle.fill.geometry.dispose();
        reticle.material.dispose();
        reticle.fillMaterial.dispose();
      }
    },
  };
};

export type { TileHighlights };
export { createTileHighlights };
