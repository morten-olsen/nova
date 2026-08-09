import type { Tile, World } from '@morten-olsen/nova-game/browser';
import * as THREE from 'three';

type TilePosition = { x: number; y: number };

type BoardUpdater = {
  pickTile: (point: THREE.Vector3) => TilePosition | undefined;
  update: (world: World) => void;
};

type BoardBounds = {
  height: number;
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
  width: number;
};

const pixelsPerTile = 96;

const getBounds = (tiles: Tile[]): BoardBounds => {
  const positions = tiles.map((tile) => tile.position);
  const minX = Math.min(0, ...positions.map((position) => position.x));
  const maxX = Math.max(0, ...positions.map((position) => position.x));
  const minY = Math.min(0, ...positions.map((position) => position.y));
  const maxY = Math.max(0, ...positions.map((position) => position.y));
  return { minX, maxX, minY, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
};

const getNoise = (x: number, y: number, seed: number): number => {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return value - Math.floor(value);
};

const getPixelPosition = (position: TilePosition, bounds: BoardBounds): TilePosition => ({
  x: (position.x - bounds.minX) * pixelsPerTile + pixelsPerTile / 2,
  y: (position.y - bounds.minY) * pixelsPerTile + pixelsPerTile / 2,
});

const drawBaseTile = (context: CanvasRenderingContext2D, tile: Tile, bounds: BoardBounds): void => {
  const x = (tile.position.x - bounds.minX) * pixelsPerTile;
  const y = (tile.position.y - bounds.minY) * pixelsPerTile;
  const noise = getNoise(tile.position.x, tile.position.y, 1);
  const hue = 23 + Math.round(noise * 16);
  const lightness = Math.round(19 + noise * 9);
  context.fillStyle = `hsl(${hue} ${22 + Math.round(noise * 12)}% ${lightness}%)`;
  context.fillRect(x, y, pixelsPerTile, pixelsPerTile);
  for (let index = 0; index < 18; index += 1) {
    const offsetX = getNoise(tile.position.x, tile.position.y, index + 3) * pixelsPerTile;
    const offsetY = getNoise(tile.position.x, tile.position.y, index + 23) * pixelsPerTile;
    const size = 1 + getNoise(tile.position.x, tile.position.y, index + 41) * 4;
    const shade = 16 + Math.round(getNoise(tile.position.x, tile.position.y, index + 59) * 20);
    context.fillStyle = `hsl(${hue + 4} 18% ${shade}% / 0.24)`;
    context.beginPath();
    context.moveTo(x + offsetX, y + offsetY - size);
    context.lineTo(x + offsetX + size, y + offsetY + size * 0.6);
    context.lineTo(x + offsetX - size * 0.8, y + offsetY + size);
    context.closePath();
    context.fill();
  }
  context.strokeStyle = `hsl(${hue - 5} 24% ${Math.max(9, lightness - 9)}% / 0.2)`;
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(x, y + pixelsPerTile * (0.2 + noise * 0.2));
  context.lineTo(x + pixelsPerTile, y + pixelsPerTile * (0.32 + noise * 0.18));
  context.stroke();
};

type RoundedPuddle = { height: number; radius: number; width: number; x: number; y: number };

const drawRoundedPuddlePath = (context: CanvasRenderingContext2D, rectangle: RoundedPuddle): void => {
  const { x, y, width, height, radius } = rectangle;
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
};

const drawAcid = (context: CanvasRenderingContext2D, tile: Tile, bounds: BoardBounds): void => {
  const amount = tile.composition.acid ?? 0;
  if (amount <= 0) {
    return;
  }
  const position = getPixelPosition(tile.position, bounds);
  const width = pixelsPerTile * (0.58 + getNoise(tile.position.x, tile.position.y, 91) * 0.14);
  const height = pixelsPerTile * (0.58 + getNoise(tile.position.x, tile.position.y, 97) * 0.14);
  const offsetX = (getNoise(tile.position.x, tile.position.y, 101) - 0.5) * pixelsPerTile * 0.14;
  const offsetY = (getNoise(tile.position.x, tile.position.y, 103) - 0.5) * pixelsPerTile * 0.14;
  const x = position.x + offsetX - width / 2;
  const y = position.y + offsetY - height / 2;
  drawRoundedPuddlePath(context, { x, y, width, height, radius: Math.min(width, height) * 0.22 });
  context.fillStyle = `rgb(69 88 25 / ${0.62 + amount * 0.05})`;
  context.fill();
  context.strokeStyle = 'rgb(32 47 12 / 0.58)';
  context.lineWidth = 1.5;
  context.stroke();
  const sheen = context.createLinearGradient(x, y, x + width, y + height);
  sheen.addColorStop(0, 'rgb(148 163 66 / 0.2)');
  sheen.addColorStop(0.45, 'rgb(109 128 38 / 0.04)');
  sheen.addColorStop(1, 'rgb(33 48 11 / 0.16)');
  drawRoundedPuddlePath(context, {
    x: x + 3,
    y: y + 3,
    width: width - 6,
    height: height - 6,
    radius: Math.min(width, height) * 0.18,
  });
  context.fillStyle = sheen;
  context.fill();
};

const drawAcidConnections = (context: CanvasRenderingContext2D, world: World, bounds: BoardBounds): void => {
  const acidTiles = new Map(world.tiles.map((tile) => [`${tile.position.x}:${tile.position.y}`, tile]));
  for (const tile of world.tiles) {
    if ((tile.composition.acid ?? 0) <= 0) {
      continue;
    }
    const position = getPixelPosition(tile.position, bounds);
    for (const [x, y, horizontal] of [
      [tile.position.x + 1, tile.position.y, true],
      [tile.position.x, tile.position.y + 1, false],
    ]) {
      if ((acidTiles.get(`${x}:${y}`)?.composition.acid ?? 0) <= 0) {
        continue;
      }
      context.fillStyle = 'rgb(60 77 20 / 0.68)';
      if (horizontal) {
        drawRoundedPuddlePath(context, {
          x: position.x + pixelsPerTile * 0.28,
          y: position.y - 13,
          width: pixelsPerTile * 0.44,
          height: 26,
          radius: 8,
        });
      } else {
        drawRoundedPuddlePath(context, {
          x: position.x - 13,
          y: position.y + pixelsPerTile * 0.28,
          width: 26,
          height: pixelsPerTile * 0.44,
          radius: 8,
        });
      }
      context.fill();
    }
  }
};

const drawRadiation = (context: CanvasRenderingContext2D, tile: Tile, bounds: BoardBounds): void => {
  const amount = tile.composition.radiation ?? 0;
  if (amount <= 0) {
    return;
  }
  const position = getPixelPosition(tile.position, bounds);
  for (let index = 0; index < 3; index += 1) {
    const offsetX = (getNoise(tile.position.x, tile.position.y, index + 14) - 0.5) * pixelsPerTile * 0.4;
    const offsetY = (getNoise(tile.position.x, tile.position.y, index + 19) - 0.5) * pixelsPerTile * 0.4;
    const radius = pixelsPerTile * (0.2 + getNoise(tile.position.x, tile.position.y, index + 27) * 0.14);
    const gradient = context.createRadialGradient(
      position.x + offsetX,
      position.y + offsetY,
      radius * 0.1,
      position.x + offsetX,
      position.y + offsetY,
      radius,
    );
    gradient.addColorStop(0, `rgb(125 211 252 / ${0.12 + amount * 0.04})`);
    gradient.addColorStop(0.55, `rgb(192 132 252 / ${0.06 + amount * 0.03})`);
    gradient.addColorStop(1, 'rgb(125 211 252 / 0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(position.x + offsetX, position.y + offsetY, radius, 0, Math.PI * 2);
    context.fill();
  }
};

const drawGrid = (context: CanvasRenderingContext2D, bounds: BoardBounds): void => {
  context.strokeStyle = 'rgb(214 151 87 / 0.16)';
  context.lineWidth = 1;
  for (let x = 0; x <= bounds.width; x += 1) {
    context.beginPath();
    context.moveTo(x * pixelsPerTile, 0);
    context.lineTo(x * pixelsPerTile, bounds.height * pixelsPerTile);
    context.stroke();
  }
  for (let y = 0; y <= bounds.height; y += 1) {
    context.beginPath();
    context.moveTo(0, y * pixelsPerTile);
    context.lineTo(bounds.width * pixelsPerTile, y * pixelsPerTile);
    context.stroke();
  }
};

const createTerrainGeometry = (bounds: BoardBounds): THREE.PlaneGeometry => {
  const segmentsPerTile = 6;
  const geometry = new THREE.PlaneGeometry(
    bounds.width,
    bounds.height,
    bounds.width * segmentsPerTile,
    bounds.height * segmentsPerTile,
  );
  const positions = geometry.getAttribute('position');
  if (!positions) {
    throw new Error('Terrain geometry is missing positions');
  }
  for (let index = 0; index < positions.count; index += 1) {
    const worldX = positions.getX(index) + (bounds.minX + bounds.maxX) / 2;
    const worldY = -positions.getY(index) + (bounds.minY + bounds.maxY) / 2;
    const rollingHeight = (getNoise(worldX, worldY, 41) - 0.5) * 0.022;
    const fineHeight = (getNoise(worldX * 3, worldY * 3, 73) - 0.5) * 0.006;
    positions.setZ(index, rollingHeight + fineHeight);
  }
  geometry.computeVertexNormals();
  return geometry;
};

const createBoardUpdater = (board: THREE.Group): BoardUpdater => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to create board texture canvas');
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.88, metalness: 0.16 });
  const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x2a1f18, roughness: 0.84, metalness: 0.18 });
  let base: THREE.Mesh | undefined;
  let terrain: THREE.Mesh | undefined;
  let bounds: BoardBounds | undefined;
  let tileKeys = new Set<string>();

  const update = (world: World): void => {
    const nextBounds = getBounds(world.tiles);
    const sizeChanged =
      !bounds ||
      bounds.width !== nextBounds.width ||
      bounds.height !== nextBounds.height ||
      bounds.minX !== nextBounds.minX ||
      bounds.minY !== nextBounds.minY;
    if (sizeChanged) {
      bounds = nextBounds;
      canvas.width = bounds.width * pixelsPerTile;
      canvas.height = bounds.height * pixelsPerTile;
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;
      base?.removeFromParent();
      base?.geometry.dispose();
      terrain?.removeFromParent();
      terrain?.geometry.dispose();
      base = new THREE.Mesh(new THREE.BoxGeometry(bounds.width, 0.08, bounds.height), baseMaterial);
      base.position.set(centerX, -0.04, centerY);
      base.receiveShadow = true;
      terrain = new THREE.Mesh(createTerrainGeometry(bounds), material);
      terrain.rotation.x = -Math.PI / 2;
      terrain.position.set(centerX, 0.04, centerY);
      terrain.receiveShadow = true;
      board.add(base, terrain);
    }
    if (!bounds) {
      return;
    }
    context.fillStyle = '#17110d';
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (const tile of world.tiles) {
      drawBaseTile(context, tile, bounds);
    }
    drawAcidConnections(context, world, bounds);
    for (const tile of world.tiles) {
      drawAcid(context, tile, bounds);
    }
    context.globalCompositeOperation = 'screen';
    for (const tile of world.tiles) {
      drawRadiation(context, tile, bounds);
    }
    context.globalCompositeOperation = 'source-over';
    drawGrid(context, bounds);
    texture.needsUpdate = true;
    tileKeys = new Set(world.tiles.map((tile) => `${tile.position.x}:${tile.position.y}`));
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

  return { pickTile, update };
};

export type { BoardUpdater, TilePosition };
export { createBoardUpdater };
