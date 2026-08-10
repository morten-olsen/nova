import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

import { cardEasing, colors, fonts, label } from './overlay.tokens.ts';

type KickerProps = {
  /** Micro uppercase line above the statement. Optional, and used sparingly. */
  eyebrow?: string;
  /** One entry per line. Two short lines beat one long one at this size. */
  lines: string[];
  /** Seconds the card holds before it leaves. Defaults to the sequence length. */
  hold?: number;
  /** Statement size in pixels. The default is the film's normal voice. */
  size?: number;
  /** Corner to sit in. The board's subject decides which one is free. */
  place?: 'bottom-left' | 'bottom-right' | 'centre' | 'top-left';
};

const easeIn = (frame: number, fps: number, delay: number): number =>
  interpolate(frame, [delay * fps, (delay + 0.72) * fps], [0, 1], {
    easing: (value) => {
      const [, , , y2] = cardEasing;
      // Cubic-bezier(0.16, 1, 0.3, 1) closely enough for a mask reveal.
      return 1 - Math.pow(1 - value, 3) * y2;
    },
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

const placements = {
  'bottom-left': { alignItems: 'flex-start', justifyContent: 'flex-end', padding: '0 0 132px 118px' },
  'bottom-right': { alignItems: 'flex-end', justifyContent: 'flex-end', padding: '0 118px 132px 0' },
  centre: { alignItems: 'center', justifyContent: 'center', padding: 0 },
  'top-left': { alignItems: 'flex-start', justifyContent: 'flex-start', padding: '116px 0 0 118px' },
} as const;

/**
 * The film's statement card.
 *
 * Each line is revealed by a mask rather than a fade: the words rise out of a
 * clipped box, which reads as deliberate rather than as a slide transition. The
 * hairline rule draws first and the lines follow it, so the eye is already in the
 * right place when the text arrives. Lines leave together and slightly upward —
 * an exit that mirrors the entrance would undo the sentence.
 */
const Kicker = ({ eyebrow, hold, lines, place = 'bottom-left', size = 74 }: KickerProps): React.ReactNode => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const outAt = (hold ?? durationInFrames / fps) - 0.55;

  const ruleWidth = easeIn(frame, fps, 0);
  const exit = interpolate(frame, [outAt * fps, (outAt + 0.55) * fps], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const centred = place === 'centre';
  // The eyebrow, the rule and the lines all hang off the same edge as the block.
  const edge = centred ? 'center' : place === 'bottom-right' ? 'right' : 'left';
  const align = centred ? 'center' : place === 'bottom-right' ? 'flex-end' : 'flex-start';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        opacity: 1 - exit,
        position: 'absolute',
        transform: `translateY(${-exit * 26}px)`,
        width: '100%',
        ...placements[place],
      }}
    >
      <div style={{ alignItems: align, display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            background:
              edge === 'right'
                ? `linear-gradient(to left, ${colors.system}, ${colors.system}00)`
                : `linear-gradient(to right, ${colors.system}, ${colors.system}00)`,
            height: 2,
            marginBottom: eyebrow ? 22 : 30,
            transform: `scaleX(${ruleWidth})`,
            transformOrigin: edge,
            width: centred ? 220 : 148,
          }}
        />
        {eyebrow ? (
          <div style={{ ...label, marginBottom: 20, opacity: easeIn(frame, fps, 0.1), textAlign: edge }}>{eyebrow}</div>
        ) : null}
        {lines.map((line, index) => {
          const reveal = easeIn(frame, fps, 0.16 + index * 0.13);
          return (
            <div key={line} style={{ overflow: 'hidden', paddingBottom: size * 0.06 }}>
              <div
                style={{
                  color: colors.ink,
                  fontFamily: fonts.sans,
                  fontSize: size,
                  fontWeight: 800,
                  letterSpacing: '-0.025em',
                  lineHeight: 1.02,
                  textAlign: edge,
                  textShadow: '0 2px 34px rgb(3 6 18 / 0.85)',
                  textTransform: 'uppercase',
                  transform: `translateY(${(1 - reveal) * 118}%)`,
                  whiteSpace: 'pre',
                }}
              >
                {line}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export { Kicker };
