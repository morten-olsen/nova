import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

import { colors, fonts, hud, label, numeric } from './overlay.tokens.ts';

type Meter = {
  /** Colour override; low battery and failing health earn the warning coral. */
  accent?: string;
  max: number;
  name: string;
  value: number;
};

type TelemetryProps = {
  accent: string;
  /** Cargo summary line, omitted when the Android is empty. */
  cargo?: string;
  glyph: string;
  meters: Meter[];
  /** Android id, shown as the card's subject. */
  subject: string;
  /** Screen position in pixels — the camera is authored, so this is too. */
  x: number;
  y: number;
};

const MeterBar = ({ accent, max, name, value }: Meter): React.ReactNode => {
  const fill = Math.max(0, Math.min(1, value / max));
  const color = accent ?? colors.system;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ alignItems: 'baseline', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ ...label, fontSize: 12, letterSpacing: '0.16em' }}>{name}</span>
        <span style={{ ...numeric, color, fontSize: 20, fontWeight: 600 }}>{value.toFixed(1)}</span>
      </div>
      <div style={{ background: colors.hairline, borderRadius: 999, height: 5, overflow: 'hidden', width: '100%' }}>
        <div
          style={{
            background: color,
            borderRadius: 999,
            boxShadow: `0 0 12px ${color}88`,
            height: '100%',
            width: `${fill * 100}%`,
          }}
        />
      </div>
    </div>
  );
};

/**
 * A status card for one Android, with a leader line to the piece it describes.
 *
 * The renderer has no tile-to-screen projection, and it does not need one: every
 * camera move in this film is authored, so where a piece lands on screen is known
 * at writing time. Hand-placing the card is both simpler and steadier than
 * tracking would be — a projected card jitters with the easing camera.
 *
 * This is the overlay that makes the hazard beat land. Health counting down in
 * tabular digits while the piece stands in acid is the game's own arithmetic,
 * visible.
 */
const Telemetry = ({ accent, cargo, glyph, meters, subject, x, y }: TelemetryProps): React.ReactNode => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const enter = interpolate(frame, [0, 0.42 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const exit = interpolate(frame, [durationInFrames - 0.42 * fps, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        left: x,
        opacity: enter * (1 - exit),
        position: 'absolute',
        top: y,
        transform: `translate(${(1 - enter) * -14}px, 0)`,
      }}
    >
      {/* Leader line back to the piece, drawn from the card's left edge. */}
      <div
        style={{
          background: `linear-gradient(to left, ${accent}, ${accent}00)`,
          height: 1,
          left: -96,
          position: 'absolute',
          top: 34,
          transform: `scaleX(${enter})`,
          transformOrigin: 'right',
          width: 96,
        }}
      />
      <div style={{ ...hud, minWidth: 268, padding: '18px 22px 20px' }}>
        <div style={{ alignItems: 'center', display: 'flex', gap: 10, marginBottom: 16 }}>
          <span style={{ color: accent, fontSize: 14, lineHeight: 1 }}>{glyph}</span>
          <span
            style={{
              ...numeric,
              color: colors.ink,
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: '0.04em',
            }}
          >
            {subject}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {meters.map((meter) => (
            <MeterBar key={meter.name} {...meter} />
          ))}
        </div>
        {cargo ? (
          <div
            style={{
              borderTop: `1px solid ${colors.hairline}`,
              color: colors.inkDim,
              fontFamily: fonts.mono,
              fontSize: 16,
              marginTop: 16,
              paddingTop: 14,
            }}
          >
            {cargo}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export type { Meter };
export { Telemetry };
