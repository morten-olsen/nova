import type { Building, World } from '@morten-olsen/nova-game';

type PieceKind = 'android' | 'material-cache' | 'unknown-structure' | Building['type'];

type PieceLayout = {
  id: string;
  kind: PieceKind;
  scale: number;
  x: number;
  z: number;
};

type PieceLocation = Omit<PieceLayout, 'scale'>;

const getTileKey = (x: number, z: number): string => `${x}:${z}`;

const addPiece = (pieces: Map<string, PieceLocation[]>, key: string, piece: PieceLocation): void => {
  const entries = pieces.get(key) ?? [];
  entries.push(piece);
  pieces.set(key, entries);
};

const hasMaterials = (materials: Record<string, number | undefined> | undefined): boolean =>
  Object.values(materials ?? {}).some((quantity) => quantity !== undefined && quantity > 0);

const collectPieceLocations = (world: World): Map<string, PieceLocation[]> => {
  const pieces = new Map<string, PieceLocation[]>();
  for (const android of world.androids) {
    // Deactivated androids stay in the world for reference, but they are off the
    // board: they neither take a piece slot nor crowd the pieces that remain.
    if (!android.active) {
      continue;
    }

    const { x, y } = android.position;
    addPiece(pieces, getTileKey(x, y), { id: android.id, kind: 'android', x, z: y });
  }

  const buildingTileKeys = new Set<string>();
  for (const building of world.buildings) {
    const { x, y } = building.position;
    const key = getTileKey(x, y);
    buildingTileKeys.add(key);
    addPiece(pieces, key, { id: building.id, kind: building.type, x, z: y });
  }

  for (const tile of world.tiles) {
    const { x, y } = tile.position;
    const key = getTileKey(x, y);
    if (hasMaterials(tile.scattered) && !buildingTileKeys.has(key)) {
      addPiece(pieces, key, { id: `material:${key}`, kind: 'material-cache', x, z: y });
    }
  }
  return pieces;
};

const getScale = (count: number): number => {
  if (count === 1) {
    return 0.78;
  }
  if (count === 2) {
    return 0.56;
  }
  return 0.45;
};

const getRadius = (count: number): number => {
  if (count === 1) {
    return 0;
  }
  if (count === 2) {
    return 0.27;
  }
  return 0.3;
};

const createTileLayouts = (entries: PieceLocation[]): PieceLayout[] => {
  entries.sort((left, right) => left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id));
  const scale = getScale(entries.length);
  const radius = getRadius(entries.length);
  return entries.map((entry, index) => {
    const angle = entries.length === 2 ? index * Math.PI : -Math.PI / 2 + (Math.PI * 2 * index) / entries.length;
    return {
      ...entry,
      scale,
      x: entry.x + Math.cos(angle) * radius,
      z: entry.z + Math.sin(angle) * radius,
    };
  });
};

const createPieceLayouts = (world: World): Map<string, PieceLayout> => {
  const layouts = new Map<string, PieceLayout>();
  for (const entries of collectPieceLocations(world).values()) {
    for (const layout of createTileLayouts(entries)) {
      layouts.set(layout.id, layout);
    }
  }
  return layouts;
};

export type { PieceKind, PieceLayout };
export { createPieceLayouts, getTileKey };
