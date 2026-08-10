import { calculateColonyScores, type World } from '@morten-olsen/nova-game/browser';
import { getFaction } from '@morten-olsen/nova-renderer';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

import { colors, fonts, hud, label, numeric } from './overlay.tokens.ts';

type ScoreboardProps = {
  /** Seconds over which the numbers travel to `world`'s values. */
  countSeconds?: number;
  /** The world the numbers came from before this shot, for the count-up. */
  from?: World;
  world: World;
};

type Row = {
  accent: string;
  glyph: string;
  name: string;
  playerId: string;
  target: number;
  start: number;
};

const toRows = (world: World, from: World | undefined): Row[] => {
  const previous = new Map((from ? calculateColonyScores(from) : []).map((score) => [score.playerId, score.total]));
  return calculateColonyScores(world).map((score) => {
    const faction = getFaction(world, score.playerId);
    return {
      accent: faction.accent,
      glyph: faction.glyph,
      name: score.playerName,
      playerId: score.playerId,
      start: previous.get(score.playerId) ?? score.total,
      target: score.total,
    };
  });
};

type ScoreRowProps = {
  /** Earns the lead marker and the brighter weight. */
  leads: boolean;
  row: Row & { value: number };
  /** Fraction of the round's combined readiness, which is what the meter shows. */
  share: number;
};

const ScoreRow = ({ leads, row, share }: ScoreRowProps): React.ReactNode => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
    <div style={{ alignItems: 'baseline', display: 'flex', gap: 10 }}>
      <span style={{ color: row.accent, fontSize: 14, lineHeight: 1 }}>{row.glyph}</span>
      <span
        style={{
          color: leads ? colors.ink : colors.inkDim,
          fontFamily: fonts.sans,
          fontSize: 19,
          fontWeight: leads ? 650 : 500,
        }}
      >
        {row.name}
      </span>
      {leads ? <span style={{ ...label, color: row.accent, fontSize: 11, letterSpacing: '0.18em' }}>Lead</span> : null}
      <span style={{ flex: 1 }} />
      <span
        style={{
          ...numeric,
          color: leads ? colors.ink : colors.inkDim,
          fontSize: 30,
          fontWeight: 600,
          letterSpacing: '-0.01em',
        }}
      >
        {Math.round(row.value).toLocaleString('en-US')}
      </span>
    </div>
    <div style={{ background: colors.hairline, borderRadius: 999, height: 6, overflow: 'hidden' }}>
      <div
        style={{
          background: row.accent,
          borderRadius: 999,
          boxShadow: `0 0 14px ${row.accent}77`,
          height: '100%',
          width: `${share * 100}%`,
        }}
      />
    </div>
  </div>
);

/**
 * Colony readiness, read straight out of the world.
 *
 * The numbers are `calculateColonyScores` on the same snapshot the board is
 * showing, so the leap when the colony module completes is the game's own scoring
 * rather than a graphic. Digits are tabular and the meter is a share of the round's
 * total, because the question the scoreboard answers is not "how many points" but
 * "who is winning, and by how much".
 */
const Scoreboard = ({ countSeconds = 1.1, from, world }: ScoreboardProps): React.ReactNode => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const rows = toRows(world, from);
  const progress = interpolate(frame, [0.25 * fps, (0.25 + countSeconds) * fps], [0, 1], {
    easing: (value) => 1 - Math.pow(1 - value, 4),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const enter = interpolate(frame, [0, 0.45 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const exit = interpolate(frame, [durationInFrames - 0.45 * fps, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const current = rows.map((row) => ({ ...row, value: row.start + (row.target - row.start) * progress }));
  const total = Math.max(
    1,
    current.reduce((sum, row) => sum + row.value, 0),
  );
  // A lead marker only means something when there is somebody to lead.
  const leaderId =
    current.length > 1 ? current.reduce((best, row) => (row.value > best.value ? row : best)).playerId : undefined;

  return (
    <div
      style={{
        ...hud,
        opacity: enter * (1 - exit),
        padding: '20px 26px 22px',
        position: 'absolute',
        right: 118,
        top: 116,
        transform: `translateY(${(1 - enter) * -16}px)`,
        width: 452,
      }}
    >
      <div style={{ ...label, marginBottom: 18 }}>Colony readiness</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {current.map((row) => (
          <ScoreRow key={row.playerId} leads={row.playerId === leaderId} row={row} share={row.value / total} />
        ))}
      </div>
    </div>
  );
};

export { Scoreboard };
