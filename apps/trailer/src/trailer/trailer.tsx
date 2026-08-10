import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from 'remotion';

import { TitleCard } from '../overlay/overlay.title.tsx';
import { colors } from '../overlay/overlay.tokens.ts';

import { ActOne } from './trailer.act-one.tsx';
import { ActTwo } from './trailer.act-two.tsx';
import {
  actOneSeconds,
  actTwoSeconds,
  actTwoStart,
  at,
  crossfadeSeconds,
  fps,
  totalSeconds,
} from './trailer.timing.ts';

/**
 * Project Nova — store-page trailer.
 *
 * Two acts on two boards, both of them real recordings replayed through the game's
 * own renderer rather than footage of a mock-up. Act one is the game's smallest
 * complete loop on an unexplored board; act two is the same rules at scale, with
 * two players, a hazard that kills, sabotage that blinds, and the one play that
 * decides it.
 *
 * The acts are separate `NovaBoard` instances because they are separate boards:
 * one renderer diffing between two different worlds would animate every piece
 * across the cut. They overlap by a few frames so the cut lands on a crossfade
 * rather than on the page background.
 */
const trailerFps = fps;
const trailerDurationInFrames = at(totalSeconds);

/** The title card's own fade, and a scrim so the wordmark sits on something. */
const titleSeconds = 8.6;
const titleStart = actTwoStart + actTwoSeconds - titleSeconds;

/**
 * Dissolves act two in over act one.
 *
 * The fade has to be on act two itself, not a scrim on top of it: act two is
 * drawn after act one, so anything laid over act two hides act one as well and
 * the "crossfade" is really two seconds of black.
 */
const Dissolve = ({ children }: { children: React.ReactNode }): React.ReactNode => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, at(crossfadeSeconds)], [0, 1], { extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

const TitleScrim = (): React.ReactNode => {
  const frame = useCurrentFrame();
  // Settles at 0.72 rather than 1: the board stays faintly alive behind the card.
  const opacity = interpolate(frame, [0, at(1.4)], [0, 0.72], { extrapolateRight: 'clamp' });
  return <AbsoluteFill style={{ backgroundColor: colors.void, opacity, pointerEvents: 'none' }} />;
};

const Trailer = (): React.ReactNode => (
  <AbsoluteFill style={{ backgroundColor: colors.void }}>
    <Sequence durationInFrames={at(actOneSeconds)} from={0} name="Act one — first light">
      <ActOne />
    </Sequence>

    <Sequence durationInFrames={at(actTwoSeconds)} from={at(actTwoStart)} name="Act two — colony race">
      <Dissolve>
        <ActTwo />
      </Dissolve>
    </Sequence>

    <Sequence durationInFrames={at(titleSeconds)} from={at(titleStart)} name="Title">
      <TitleScrim />
      <TitleCard />
    </Sequence>
  </AbsoluteFill>
);

export { Trailer, trailerDurationInFrames, trailerFps };
