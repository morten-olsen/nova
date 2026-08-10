import { AbsoluteFill, random } from 'remotion';
import { useMemo } from 'react';

import { colors } from './overlay.tokens.ts';

/**
 * The permanent cinematic frame: a vignette, a whisper of grain, and scrims top
 * and bottom.
 *
 * The board is lit for a screen you lean into, not a screen across a room. The
 * vignette pulls the eye off the tray's bright rim and back to the middle, and
 * the scrims give the type something to sit on so overlays never fight the
 * terrain for contrast. Grain is the one thing here that is purely texture — at
 * this strength it reads as a lens rather than as noise.
 */
const grainDotCount = 1_100;

type NovaFrameProps = {
  /** 0 disables the top scrim for shots with nothing in the upper third. */
  topScrim?: number;
  vignette?: number;
};

const Grain = (): React.ReactNode => {
  // Seeded, so the grain is identical in every render of the same frame.
  const dots = useMemo(
    () =>
      Array.from({ length: grainDotCount }, (_, index) => ({
        left: `${random(`gx${index}`) * 100}%`,
        opacity: 0.02 + random(`go${index}`) * 0.05,
        size: 1 + Math.round(random(`gs${index}`) * 2),
        top: `${random(`gy${index}`) * 100}%`,
      })),
    [],
  );

  return (
    <AbsoluteFill style={{ mixBlendMode: 'screen', pointerEvents: 'none' }}>
      {dots.map((dot, index) => (
        <div
          key={index}
          style={{
            background: '#ffffff',
            borderRadius: '50%',
            height: dot.size,
            left: dot.left,
            opacity: dot.opacity,
            position: 'absolute',
            top: dot.top,
            width: dot.size,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

const NovaFrame = ({ topScrim = 0.55, vignette = 0.9 }: NovaFrameProps): React.ReactNode => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    <AbsoluteFill
      style={{
        background: `radial-gradient(118% 82% at 50% 46%, transparent 38%, rgb(2 4 12 / ${0.5 * vignette}) 78%, rgb(1 2 8 / ${0.92 * vignette}) 100%)`,
      }}
    />
    <AbsoluteFill
      style={{
        background: `linear-gradient(to bottom, rgb(3 6 16 / ${topScrim}) 0%, transparent 26%, transparent 62%, rgb(3 6 16 / 0.78) 100%)`,
      }}
    />
    <Grain />
    {/* A hairline of the system accent along the bottom: the board's own UI edge. */}
    <div
      style={{
        background: `linear-gradient(to right, transparent, ${colors.system}22 30%, ${colors.system}22 70%, transparent)`,
        bottom: 0,
        height: 1,
        left: 0,
        position: 'absolute',
        right: 0,
      }}
    />
  </AbsoluteFill>
);

export { NovaFrame };
