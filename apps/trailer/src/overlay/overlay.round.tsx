import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

import type { BoardCue } from '../board/board.cues.ts';
import type { TimelineFrame } from '../board/board.timeline.ts';

import { colors, label, numeric } from './overlay.tokens.ts';

type RoundTickerProps = {
  /** The same cue list the board is running. */
  cues: BoardCue[];
  frames: TimelineFrame[];
  /** Seconds the cue list is offset by, when the ticker sits in its own sequence. */
  offset?: number;
};

/**
 * A small round counter in the corner.
 *
 * It reads the round out of the board's own cue list rather than counting at a
 * rate given to it, because shots hold a round while the camera moves and then
 * play several in a second. A ticker running at an assumed rate would drift from
 * the board within one shot and quietly start captioning rounds that are not on
 * screen — the one thing this element exists to be trusted about.
 */
const currentRound = (cues: BoardCue[], frames: TimelineFrame[], seconds: number): number | undefined => {
  let index: number | undefined;
  for (const cue of cues) {
    if (cue.type === 'world' && cue.at <= seconds + 0.0001) {
      index = cue.world;
    }
  }
  if (index === undefined) {
    return undefined;
  }
  return frames[Math.min(Math.max(index, 0), frames.length - 1)]?.round;
};

const RoundTicker = ({ cues, frames, offset = 0 }: RoundTickerProps): React.ReactNode => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const round = currentRound(cues, frames, frame / fps + offset);
  const enter = interpolate(frame, [0, 0.6 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const exit = interpolate(frame, [durationInFrames - 0.5 * fps, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  if (round === undefined) {
    return null;
  }

  return (
    <div
      style={{
        alignItems: 'baseline',
        bottom: 62,
        display: 'flex',
        gap: 12,
        left: 118,
        opacity: enter * (1 - exit) * 0.85,
        position: 'absolute',
      }}
    >
      <span style={{ ...label, fontSize: 13 }}>Round</span>
      <span style={{ ...numeric, color: colors.inkDim, fontSize: 26, fontWeight: 600 }}>
        {String(round).padStart(2, '0')}
      </span>
    </div>
  );
};

export { RoundTicker };
