import { AbsoluteFill } from 'remotion';

import { camera, cut, rounds, select, world } from '../board/board.cues.ts';
import { NovaBoard } from '../board/board.tsx';

import { colonyRace } from './trailer.recordings.ts';

/**
 * A plain twelve seconds of board, no overlay and no cuts.
 *
 * This is the diagnostic composition: it answers whether the GLBs loaded, whether
 * fog reads as unknown rather than merely dim, and whether a camera move lands on
 * the tile it was aimed at — all of which are much easier to see without title
 * cards on top.
 */
const checkCues = [
  world(0, 0),
  cut(0, { distance: 22 }),
  camera(0.5, { distance: 13, duration: 3, position: { x: 7, y: 7 } }),
  select(1, { pieceId: 'aurora-colony-module', position: { x: 6, y: 6 } }),
  ...rounds(4, 1, 10, 0.8),
];

const BoardCheck = (): React.ReactNode => (
  <AbsoluteFill style={{ backgroundColor: '#050816' }}>
    <NovaBoard cues={checkCues} recording={colonyRace.recording} />
  </AbsoluteFill>
);

export { BoardCheck };
