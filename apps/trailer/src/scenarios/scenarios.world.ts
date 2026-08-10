import type { Android, Building, BuildingType, MaterialBundle, Tile, TileComposition } from '@morten-olsen/nova-game';

/** `'x,y'`, so a scenario reads as a sparse map of the board. */
type TileKey = `${number},${number}`;

type BoardSpec = {
  /** Sparse hazard and natural-resource overrides, keyed `'x,y'`. */
  composition?: Partial<Record<TileKey, TileComposition>>;
  height: number;
  /** Sparse loose earth-launched material, keyed `'x,y'`. Each becomes a visible cache piece. */
  scattered?: Partial<Record<TileKey, MaterialBundle>>;
  width: number;
};

const parseTileKey = (key: string): { x: number; y: number } => {
  const [x, y] = key.split(',').map(Number);
  if (x === undefined || y === undefined || Number.isNaN(x) || Number.isNaN(y)) {
    throw new Error(`Malformed tile key '${key}', expected 'x,y'`);
  }
  return { x, y };
};

/**
 * Fails loudly on a key that is off the board. A silently ignored typo in a
 * hazard field is the sort of thing that only shows up as a missing acid pool
 * three minutes into a render.
 */
const assertOnBoard = (label: string, keys: string[], width: number, height: number): void => {
  for (const key of keys) {
    const { x, y } = parseTileKey(key);
    if (x < 0 || y < 0 || x >= width || y >= height) {
      throw new Error(`${label} key '${key}' is outside the ${width}x${height} board`);
    }
  }
};

const createTiles = ({ composition = {}, height, scattered = {}, width }: BoardSpec): Tile[] => {
  assertOnBoard('composition', Object.keys(composition), width, height);
  assertOnBoard('scattered', Object.keys(scattered), width, height);

  const tiles: Tile[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const key: TileKey = `${x},${y}`;
      const tile: Tile = { composition: { ...composition[key] }, position: { x, y } };
      const loose = scattered[key];
      if (loose) {
        tile.scattered = { ...loose };
      }
      tiles.push(tile);
    }
  }
  return tiles;
};

type BuildingSpec = {
  /** Ticks of construction left. Zero, the default, means completed and scoring. */
  construction?: number;
  health?: number;
  id: string;
  /** Initial chargers cannot be salvaged, so exactly one per player carries this. */
  initial?: boolean;
  ownerId: string;
  storage?: MaterialBundle;
  type: BuildingType;
  x: number;
  y: number;
};

const storageTypes = new Set<BuildingType>(['depot', 'extractor', 'processor', 'acid-processing-plant']);

/**
 * Ids are descriptive rather than `building-N` on purpose: `start-construction`
 * mints ids as `building-${buildings.length + 1}`, so a pre-placed set using that
 * shape collides with anything built during the recording the moment one of the
 * originals is salvaged.
 */
const createBuilding = ({
  construction = 0,
  health = 100,
  id,
  initial = false,
  ownerId,
  storage,
  type,
  x,
  y,
}: BuildingSpec): Building => {
  if (storage && !storageTypes.has(type)) {
    throw new Error(`Building '${id}' is a ${type}, which has no storage`);
  }
  return {
    health,
    id,
    initial,
    ownerId,
    position: { x, y },
    remainingConstruction: { resources: {}, ticks: construction },
    ...(storageTypes.has(type) ? { storage: { ...storage } } : {}),
    type,
  };
};

type AndroidSpec = {
  battery?: number;
  cargo?: MaterialBundle;
  health?: number;
  id: string;
  ownerId: string;
  /** The log a player reads back after the Android is gone. */
  recording?: string;
  scriptId: string;
  x: number;
  y: number;
};

const createAndroid = ({
  battery = 100,
  cargo,
  health = 100,
  id,
  ownerId,
  recording = '',
  scriptId,
  x,
  y,
}: AndroidSpec): Android => ({
  active: true,
  battery,
  ...(cargo ? { cargo: { ...cargo } } : {}),
  health,
  id,
  memory: '',
  ownerId,
  position: { x, y },
  recording,
  scriptId,
});

/** Guards against two buildings on one tile, which the rules forbid. */
const assertOneBuildingPerTile = (buildings: Building[]): void => {
  const seen = new Set<string>();
  for (const building of buildings) {
    const key = `${building.position.x},${building.position.y}`;
    if (seen.has(key)) {
      throw new Error(`Two buildings share tile ${key}`);
    }
    seen.add(key);
  }
};

export type { AndroidSpec, BoardSpec, BuildingSpec, TileKey };
export { assertOneBuildingPerTile, createAndroid, createBuilding, createTiles };
