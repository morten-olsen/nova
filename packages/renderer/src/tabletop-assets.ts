import type { Building } from '@morten-olsen/nova-game/browser';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';

import type { PieceKind } from './tabletop-layout.js';

const assetUrls: Record<PieceKind, string> = {
  android: new URL('../assets/models/android.glb', import.meta.url).href,
  'material-cache': new URL('../assets/models/material-cache.glb', import.meta.url).href,
  charger: new URL('../assets/models/charger.glb', import.meta.url).href,
  depot: new URL('../assets/models/depot.glb', import.meta.url).href,
  extractor: new URL('../assets/models/extractor.glb', import.meta.url).href,
  processor: new URL('../assets/models/processor.glb', import.meta.url).href,
  'acid-processing-plant': new URL('../assets/models/acid-processing-plant.glb', import.meta.url).href,
  'relay-tower': new URL('../assets/models/relay-tower.glb', import.meta.url).href,
  scanner: new URL('../assets/models/scanner.glb', import.meta.url).href,
  'colony-module': new URL('../assets/models/colony-module.glb', import.meta.url).href,
};

const loader = new GLTFLoader();
const models = new Map<PieceKind, Promise<THREE.Group>>();

const loadPieceModel = (kind: PieceKind): Promise<THREE.Group> => {
  const cachedModel = models.get(kind);
  if (cachedModel) {
    return cachedModel;
  }

  const model = loader.loadAsync(assetUrls[kind]).then(({ scene }) => scene);
  models.set(kind, model);
  return model;
};

const createPlaceholder = (kind: PieceKind): THREE.Group => {
  const group = new THREE.Group();
  const geometry =
    kind === 'android' ? new THREE.DodecahedronGeometry(0.18, 0) : new THREE.BoxGeometry(0.42, 0.42, 0.42);
  const material = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.5, metalness: 0.5 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = kind === 'android' ? 0.22 : 0.25;
  group.add(mesh);
  return group;
};

const setOwnerColor = (object: THREE.Object3D, color: THREE.Color): void => {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }
    const sourceMaterial = child.material;
    const materials = Array.isArray(sourceMaterial) ? sourceMaterial : [sourceMaterial];
    const tintedMaterials = materials.map((material) => {
      const tinted = material.clone();
      if (tinted.name === 'FactionAccent') {
        tinted.color.copy(color);
        if ('emissive' in tinted) {
          tinted.emissive.copy(color);
        }
      }
      return tinted;
    });
    child.material = Array.isArray(sourceMaterial) ? tintedMaterials : (tintedMaterials[0] ?? sourceMaterial);
    child.castShadow = true;
    child.receiveShadow = true;
  });
};

const getBuildingKind = (building: Building): PieceKind => building.type;

export { createPlaceholder, getBuildingKind, loadPieceModel, setOwnerColor };
