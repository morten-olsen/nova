import type { Tile } from '@morten-olsen/nova-game/browser';

type TilePosition = { x: number; y: number };

type BoardBounds = {
  height: number;
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
  width: number;
};

/** Texture resolution of the board's detail layer, in pixels per tile. */
const pixelsPerTile = 96;

const getBounds = (tiles: Tile[]): BoardBounds => {
  const positions = tiles.map((tile) => tile.position);
  const minX = Math.min(0, ...positions.map((position) => position.x));
  const maxX = Math.max(0, ...positions.map((position) => position.x));
  const minY = Math.min(0, ...positions.map((position) => position.y));
  const maxY = Math.max(0, ...positions.map((position) => position.y));
  return { minX, maxX, minY, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
};

/** Top-left corner of a tile in texture pixels. */
const getTileOrigin = (position: TilePosition, bounds: BoardBounds): TilePosition => ({
  x: (position.x - bounds.minX) * pixelsPerTile,
  y: (position.y - bounds.minY) * pixelsPerTile,
});

/** Centre of a tile in texture pixels. */
const getPixelPosition = (position: TilePosition, bounds: BoardBounds): TilePosition => ({
  x: (position.x - bounds.minX) * pixelsPerTile + pixelsPerTile / 2,
  y: (position.y - bounds.minY) * pixelsPerTile + pixelsPerTile / 2,
});

const isSameBounds = (left: BoardBounds | undefined, right: BoardBounds): boolean =>
  left !== undefined &&
  left.width === right.width &&
  left.height === right.height &&
  left.minX === right.minX &&
  left.minY === right.minY;

export type { BoardBounds, TilePosition };
export { getBounds, getPixelPosition, getTileOrigin, isSameBounds, pixelsPerTile };
