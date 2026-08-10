import type { Android, Building, Tile, World } from '@morten-olsen/nova-game';
import type { TileClickEvent, TilePosition } from '@morten-olsen/nova-renderer';

/**
 * What the inspector is currently showing. Entities are held by id rather than
 * by value so the selection survives scrubbing the timeline — the same android
 * is re-resolved against whichever world frame is on screen.
 */
type Selection =
  { id: string; kind: 'android' } | { id: string; kind: 'building' } | { kind: 'tile'; position: TilePosition };

type ResolvedSelection =
  | { android: Android; kind: 'android'; position: TilePosition }
  | { building: Building; kind: 'building'; position: TilePosition }
  | { kind: 'tile'; position: TilePosition; tile: Tile | undefined };

const findTile = (world: World, position: TilePosition): Tile | undefined =>
  world.tiles.find((tile) => tile.position.x === position.x && tile.position.y === position.y);

/**
 * Resolves a selection against a world frame. Returns undefined when the
 * selected entity does not exist in this frame — it may have been built later or
 * destroyed earlier in the recording.
 */
const resolveSelection = (world: World, selection: Selection | undefined): ResolvedSelection | undefined => {
  if (!selection) {
    return undefined;
  }
  if (selection.kind === 'tile') {
    return { kind: 'tile', position: selection.position, tile: findTile(world, selection.position) };
  }
  if (selection.kind === 'android') {
    const android = world.androids.find((candidate) => candidate.id === selection.id);
    return android ? { android, kind: 'android', position: android.position } : undefined;
  }
  const building = world.buildings.find((candidate) => candidate.id === selection.id);
  return building ? { building, kind: 'building', position: building.position } : undefined;
};

/**
 * Turns a board click into a selection. Clicking a model selects that entity;
 * clicking bare ground selects the tile.
 */
const selectionFromBoardClick = (world: World, event: TileClickEvent): Selection => {
  if (event.pieceId) {
    if (world.androids.some((android) => android.id === event.pieceId)) {
      return { id: event.pieceId, kind: 'android' };
    }
    if (world.buildings.some((building) => building.id === event.pieceId)) {
      return { id: event.pieceId, kind: 'building' };
    }
  }
  return { kind: 'tile', position: event.position };
};

/** The id the renderer should raise, for selections that correspond to a piece. */
const getSelectedPieceId = (selection: Selection | undefined): string | undefined =>
  selection && selection.kind !== 'tile' ? selection.id : undefined;

const isSameSelection = (left: Selection | undefined, right: Selection | undefined): boolean => {
  if (!left || !right || left.kind !== right.kind) {
    return false;
  }
  if (left.kind === 'tile' && right.kind === 'tile') {
    return left.position.x === right.position.x && left.position.y === right.position.y;
  }
  return 'id' in left && 'id' in right && left.id === right.id;
};

export type { ResolvedSelection, Selection };
export { findTile, getSelectedPieceId, isSameSelection, resolveSelection, selectionFromBoardClick };
