import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

import { colors, fonts, label, numeric } from './overlay.tokens.ts';

/**
 * The end card.
 *
 * A wordmark rather than a headline: "PROJECT" sits small and wide above "NOVA"
 * set large and tight, which is the shape of an engineering nameplate and matches
 * the game's frontier-NASA-punk direction far better than a single centred line
 * would. The system-cyan rules above and below are the same hairlines the HUD uses,
 * so the card reads as part of the same object as the board it fades out of.
 *
 * The glyph is Aurora's diamond, the seat-zero faction marker — the one piece of
 * the palette a returning player already recognises.
 */
const ease = (frame: number, fps: number, delay: number, duration = 0.8): number =>
  interpolate(frame, [delay * fps, (delay + duration) * fps], [0, 1], {
    easing: (value) => 1 - Math.pow(1 - value, 3),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

/** A hairline of the system accent, drawn out from the centre. */
const Rule = ({ progress, top }: { progress: number; top?: boolean }): React.ReactNode => (
  <div
    style={{
      background: `linear-gradient(to right, transparent, ${colors.system}, transparent)`,
      height: 1,
      marginTop: top ? 0 : 30,
      opacity: progress,
      transform: `scaleX(${progress})`,
      width: 560,
    }}
  />
);

const Wordmark = ({ progress }: { progress: number }): React.ReactNode => (
  <>
    <div
      style={{
        ...label,
        color: colors.system,
        fontSize: 27,
        letterSpacing: '0.62em',
        margin: '34px 0 6px',
        opacity: progress,
        // Letterspacing pads the right edge; pull it back to stay optically centred.
        textIndent: '0.62em',
        transform: `translateY(${(1 - progress) * 14}px)`,
      }}
    >
      Project
    </div>
    <div
      style={{
        color: colors.ink,
        fontFamily: fonts.sans,
        fontSize: 210,
        fontWeight: 800,
        letterSpacing: '-0.045em',
        lineHeight: 0.94,
        opacity: progress,
        textShadow: `0 0 90px ${colors.system}30, 0 6px 60px rgb(3 6 18 / 0.9)`,
        transform: `scale(${0.96 + progress * 0.04})`,
      }}
    >
      NOVA
    </div>
  </>
);

const TitleCard = (): React.ReactNode => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const mark = ease(frame, fps, 0.15, 1);
  const rule = ease(frame, fps, 0.5, 1.1);
  const tagline = ease(frame, fps, 1.15);
  const call = ease(frame, fps, 1.7);

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ alignItems: 'center', display: 'flex', flexDirection: 'column' }}>
        <Rule progress={rule} top />
        <Wordmark progress={mark} />
        <Rule progress={rule} />
        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            gap: 16,
            marginTop: 34,
            opacity: tagline,
            transform: `translateY(${(1 - tagline) * 12}px)`,
          }}
        >
          <span style={{ color: colors.system, fontSize: 15, lineHeight: 1 }}>◆</span>
          <span
            style={{
              color: colors.inkDim,
              fontFamily: fonts.sans,
              fontSize: 31,
              fontWeight: 400,
              letterSpacing: '0.02em',
            }}
          >
            Program the Androids. Prepare the planet.
          </span>
          <span style={{ color: colors.system, fontSize: 15, lineHeight: 1 }}>◆</span>
        </div>
        <div
          style={{
            alignItems: 'center',
            border: `1px solid ${colors.system}66`,
            borderRadius: 999,
            display: 'flex',
            gap: 14,
            marginTop: 54,
            opacity: call,
            padding: '15px 34px',
            transform: `translateY(${(1 - call) * 10}px)`,
          }}
        >
          <span style={{ ...label, color: colors.system, fontSize: 17, letterSpacing: '0.26em' }}>
            Wishlist on Steam
          </span>
        </div>
        <div style={{ ...label, ...numeric, fontSize: 13, letterSpacing: '0.3em', marginTop: 30, opacity: call * 0.7 }}>
          Windows · macOS · Linux
        </div>
      </div>
    </AbsoluteFill>
  );
};

export { TitleCard };
