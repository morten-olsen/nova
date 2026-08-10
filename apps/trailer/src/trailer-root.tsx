import { Composition } from 'remotion';

import { BoardCheck } from './trailer/trailer.board-check.tsx';
import { DesignCheck } from './trailer/trailer.design-check.tsx';
import { Trailer, trailerDurationInFrames, trailerFps } from './trailer/trailer.tsx';

/**
 * 1920x1080 at 30fps: Steam's baseline for a store-page trailer, and the format
 * every downstream crop and thumbnail is derived from.
 */
const width = 1_920;
const height = 1_080;

const TrailerRoot = (): React.ReactNode => (
  <>
    <Composition
      component={Trailer}
      durationInFrames={trailerDurationInFrames}
      fps={trailerFps}
      height={height}
      id="nova-trailer"
      width={width}
    />
    {/*
      The board with no overlay and no cuts, for judging the render itself:
      whether models loaded, whether fog reads, whether a camera move lands where
      it was aimed. Much cheaper to iterate on than the full film.
    */}
    <Composition
      component={BoardCheck}
      durationInFrames={trailerFps * 12}
      fps={trailerFps}
      height={height}
      id="nova-board-check"
      width={width}
    />
    {/* Every overlay component at once, for judging the 2D layer as a set. */}
    <Composition
      component={DesignCheck}
      durationInFrames={trailerFps * 10}
      fps={trailerFps}
      height={height}
      id="nova-design-check"
      width={width}
    />
  </>
);

export { TrailerRoot };
