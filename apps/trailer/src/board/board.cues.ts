import type { CameraMove, TabletopSelection, TilePosition } from '@morten-olsen/nova-renderer';

/**
 * The director's score for the 3D layer.
 *
 * Everything the board does during a shot is one of four instructions on a
 * timeline: show a round, move the camera, point at something, or let go. Keeping
 * them as data rather than as branches inside the component means a shot can be
 * read, reordered and retimed without touching the stepping loop — and the
 * stepping loop stays the only thing that knows about `advance`.
 *
 * `at` is seconds from the start of the shot the cue belongs to, not from the
 * start of the film, so a shot can be moved without retiming its contents.
 */
type BoardCue =
  | { at: number; duration?: number; type: 'camera-reset' }
  | { at: number; move: CameraMove; type: 'camera' }
  | { at: number; selection: TabletopSelection; type: 'select' }
  | { at: number; type: 'world'; world: number };

/** Cuts to a round. */
const world = (at: number, index: number): BoardCue => ({ at, type: 'world', world: index });

/** Eases the camera. Omit `position` to zoom without panning, `distance` to pan without zooming. */
const camera = (at: number, move: CameraMove): BoardCue => ({ at, move, type: 'camera' });

/** Snaps the camera with no travel — a cut rather than a move. */
const cut = (at: number, move: Omit<CameraMove, 'duration'>): BoardCue => ({
  at,
  move: { ...move, duration: 0 },
  type: 'camera',
});

const resetCamera = (at: number, duration?: number): BoardCue => ({ at, duration, type: 'camera-reset' });

/** Places the reticle, and raises a piece when `pieceId` is given. */
const select = (at: number, selection: TabletopSelection): BoardCue => ({ at, selection, type: 'select' });

const clearSelection = (at: number): BoardCue => select(at, {});

/**
 * Plays rounds `from..to` at a fixed interval — the montage primitive.
 *
 * Rounds have no inherent duration, so a passage that wants to feel like time
 * passing has to be given one explicitly.
 */
const rounds = (at: number, from: number, to: number, everySeconds: number): BoardCue[] => {
  const cues: BoardCue[] = [];
  for (let index = from; index <= to; index += 1) {
    cues.push(world(at + (index - from) * everySeconds, index));
  }
  return cues;
};

/** Pushes in on a tile by a factor of the current distance, for relative moves. */
const pushIn = (at: number, position: TilePosition, distance: number, duration: number): BoardCue =>
  camera(at, { distance, duration, position });

type FrameCues = Map<number, BoardCue[]>;

/**
 * Buckets cues by output frame so the stepping loop can apply them without
 * scanning the list once per frame.
 */
const toFrameCues = (cues: BoardCue[], fps: number): FrameCues => {
  const byFrame: FrameCues = new Map();
  for (const cue of [...cues].sort((left, right) => left.at - right.at)) {
    const frame = Math.max(0, Math.round(cue.at * fps));
    byFrame.set(frame, [...(byFrame.get(frame) ?? []), cue]);
  }
  return byFrame;
};

export type { BoardCue, FrameCues };
export { camera, clearSelection, cut, pushIn, resetCamera, rounds, select, toFrameCues, world };
