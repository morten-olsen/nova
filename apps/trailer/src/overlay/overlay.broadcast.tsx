import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

import { colors, fonts, hud, label, numeric } from './overlay.tokens.ts';

type BroadcastProps = {
  accent: string;
  content: string;
  glyph: string;
  /** Android that sent it. */
  sender: string;
  /** Coral instead of the faction accent, for a transmission that is a distress call. */
  distress?: boolean;
  round: number;
  y?: number;
};

/**
 * A public broadcast, presented as the radio traffic it is.
 *
 * Every Android can put 256 characters into the world, and the rulebook lists
 * deception and negotiation alongside coordination as reasons to. Set in mono
 * with a signal bar and a round stamp, a line of it does more to establish that
 * other players exist than a shot of their buildings would.
 */
const Broadcast = ({ accent, content, distress, glyph, round, sender, y = 786 }: BroadcastProps): React.ReactNode => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const color = distress ? colors.warning : accent;

  const enter = interpolate(frame, [0, 0.5 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const exit = interpolate(frame, [durationInFrames - 0.45 * fps, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // A slow two-beat pulse on the signal dot: alive, not urgent.
  const pulse = 0.55 + 0.45 * Math.sin((frame / fps) * Math.PI * 1.6);
  const reveal = Math.round(interpolate(enter, [0, 1], [0, content.length]));

  return (
    <div
      style={{
        ...hud,
        alignItems: 'center',
        borderLeft: `2px solid ${color}`,
        display: 'flex',
        gap: 20,
        left: 118,
        opacity: enter * (1 - exit),
        padding: '18px 30px 18px 24px',
        position: 'absolute',
        top: y,
        transform: `translateY(${(1 - enter) * 14}px)`,
      }}
    >
      <div
        style={{
          background: color,
          borderRadius: '50%',
          boxShadow: `0 0 ${8 + pulse * 12}px ${color}`,
          height: 9,
          opacity: 0.5 + pulse * 0.5,
          width: 9,
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ alignItems: 'center', display: 'flex', gap: 10 }}>
          <span style={{ color, fontSize: 12, lineHeight: 1 }}>{glyph}</span>
          <span style={{ ...label, color: colors.inkDim, fontSize: 12 }}>
            {distress ? 'Distress' : 'Broadcast'} · {sender}
          </span>
          <span style={{ ...label, ...numeric, color: colors.inkFaint, fontSize: 12 }}>Round {round}</span>
        </div>
        <div style={{ color: colors.ink, fontFamily: fonts.mono, fontSize: 23, letterSpacing: '-0.005em' }}>
          {content.slice(0, reveal)}
        </div>
      </div>
    </div>
  );
};

export { Broadcast };
