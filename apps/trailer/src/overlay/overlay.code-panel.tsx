import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { useMemo } from 'react';

import { clipLines, countCharacters, tokenColors, tokenizeLines, type Token } from './overlay.code.ts';
import { colors, fonts, hud, label, numeric } from './overlay.tokens.ts';

type CodePanelProps = {
  /** Faction accent for the title bar, so the panel is owned by somebody. */
  accent: string;
  /** Highlight a 1-based line, for pointing at the line that matters. */
  callout?: number;
  charactersPerSecond?: number;
  glyph: string;
  /** Script name, shown as the file. */
  name: string;
  /** Where the panel sits. Left is the default; the board usually holds the right. */
  side?: 'left' | 'right';
  source: string;
  width?: number;
};

type CodeLineProps = {
  /** Draws the typing caret after the last token. */
  caret: boolean;
  /** Marks the line the shot is pointing at, in warning coral. */
  highlighted: boolean;
  number: number;
  tokens: Token[];
};

const CodeLine = ({ caret, highlighted, number, tokens }: CodeLineProps): React.ReactNode => (
  <div
    style={{
      background: highlighted ? `${colors.warning}14` : undefined,
      borderLeft: `2px solid ${highlighted ? colors.warning : 'transparent'}`,
      display: 'flex',
      gap: 18,
      margin: '0 -22px',
      padding: '0 22px 0 20px',
    }}
  >
    <span
      style={{
        ...numeric,
        color: highlighted ? colors.warning : colors.inkFaint,
        fontSize: 19,
        lineHeight: 1.62,
        minWidth: 26,
        opacity: highlighted ? 1 : 0.55,
        textAlign: 'right',
      }}
    >
      {number}
    </span>
    {/*
      Never wrap. A wrapped line desynchronises the gutter from the code and makes
      the callout highlight cover the wrong rows; clipping a too-long line is the
      honest failure, and the fix is a shorter excerpt.
    */}
    <span
      style={{
        fontFamily: fonts.mono,
        fontSize: 19,
        lineHeight: 1.62,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'pre',
      }}
    >
      {tokens.map((token, index) => (
        <span
          key={index}
          style={{ color: tokenColors[token.kind], fontStyle: token.kind === 'comment' ? 'italic' : undefined }}
        >
          {token.value}
        </span>
      ))}
      {caret ? <span style={{ background: colors.system, color: colors.system, marginLeft: 1 }}>&nbsp;</span> : null}
    </span>
  </div>
);

/**
 * A script, typing itself out.
 *
 * This is the panel that has to sell what the game actually is: nobody commands
 * these Androids, somebody wrote them. So the code is real — it is lifted from the
 * recording playing behind it — and it types at a readable pace rather than
 * appearing whole, because the act of writing is the verb being advertised.
 */
const CodePanel = ({
  accent,
  callout,
  charactersPerSecond = 62,
  glyph,
  name,
  side = 'left',
  source,
  width = 700,
}: CodePanelProps): React.ReactNode => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const lines = useMemo(() => tokenizeLines(source), [source]);
  const total = useMemo(() => countCharacters(lines), [lines]);
  const typed = Math.min(total, Math.round((frame / fps) * charactersPerSecond));
  const visible = useMemo(() => clipLines(lines, typed), [lines, typed]);

  const enter = interpolate(frame, [0, 0.5 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const exit = interpolate(frame, [durationInFrames - 0.5 * fps, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const caretOn = Math.floor((frame / fps) * 2) % 2 === 0 && typed < total;

  return (
    <div
      style={{
        ...hud,
        left: side === 'left' ? 118 : undefined,
        opacity: enter * (1 - exit),
        overflow: 'hidden',
        position: 'absolute',
        right: side === 'right' ? 118 : undefined,
        top: 150,
        transform: `translateY(${(1 - enter) * 22 + exit * -18}px)`,
        width,
      }}
    >
      <div
        style={{
          alignItems: 'center',
          borderBottom: `1px solid ${colors.hairline}`,
          display: 'flex',
          gap: 12,
          padding: '16px 22px',
        }}
      >
        <span style={{ color: accent, fontSize: 15, lineHeight: 1 }}>{glyph}</span>
        <span style={{ ...label, color: colors.inkDim, fontSize: 15, letterSpacing: '0.14em' }}>{name}.js</span>
        <span style={{ flex: 1 }} />
        <span style={{ ...label, ...numeric, fontSize: 13, letterSpacing: '0.1em' }}>{lines.length} LINES</span>
      </div>
      <div style={{ padding: '20px 22px 24px' }}>
        {visible.map((line, index) => (
          <CodeLine
            caret={index === visible.length - 1 && caretOn}
            highlighted={callout === index + 1}
            key={index}
            number={index + 1}
            tokens={line}
          />
        ))}
      </div>
    </div>
  );
};

export { CodePanel };
