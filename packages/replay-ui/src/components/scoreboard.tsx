import { calculateColonyScores, type PlayerScore, type Rules, type World } from '@morten-olsen/nova-game';
import { getFaction } from '@morten-olsen/nova-renderer';
import { useState } from 'react';

type ScoreboardProps = {
  world: World;
  /**
   * The rules the recording was played under, so a retuned match is not scored
   * against the shipped table. Defaults to the shipped one when omitted.
   */
  rules?: Rules;
};

type PlayerRowProps = {
  accent: string;
  expanded: boolean;
  glyph: string;
  leading: boolean;
  onToggle: () => void;
  score: PlayerScore;
  share: number;
};

const PlayerRow = ({ accent, expanded, glyph, leading, onToggle, score, share }: PlayerRowProps): React.ReactNode => {
  return (
    <li>
      <button
        aria-expanded={expanded}
        className="group w-full cursor-pointer rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-white/5"
        type="button"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2.5">
          {/* Colour never carries ownership alone: the glyph is always with it. */}
          <span aria-hidden className="text-[0.7rem] leading-none" style={{ color: accent }}>
            {glyph}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{score.playerName}</span>
          {leading ? <span className="label !text-[0.6rem] !tracking-wider text-energy">Lead</span> : null}
          <span className="num text-base font-semibold tabular-nums text-ink">{score.total}</span>
          <svg
            aria-hidden
            className={`size-3 shrink-0 text-ink-faint transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-hairline">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ background: accent, width: `${Math.max(2, share * 100)}%` }}
          />
        </div>
      </button>
      {expanded ? (
        <ul className="rise mt-1 mb-1 space-y-1 border-l-2 pl-3 text-xs" style={{ borderColor: accent }}>
          {score.contributors.length ? (
            score.contributors.map((contributor) => (
              <li key={contributor.id} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-ink-dim">{contributor.label}</span>
                <span className="num shrink-0 text-ink-faint">
                  <span className="text-ink-dim">{contributor.quantity}</span> · {contributor.points}
                </span>
              </li>
            ))
          ) : (
            <li className="text-ink-faint">No viable colony assets yet.</li>
          )}
        </ul>
      ) : null}
    </li>
  );
};

/**
 * Collapsed by default: the score is the headline, and the breakdown is a detail
 * you ask for. Showing every contributor at once crowded out the board.
 */
const Scoreboard = ({ rules, world }: ScoreboardProps): React.ReactNode => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const scores = calculateColonyScores(world, rules);
  const best = Math.max(1, ...scores.map((score) => score.total));

  return (
    <section className="hud w-64 p-2.5">
      <div className="flex items-baseline justify-between gap-3 px-1 pb-1.5">
        <h2 className="label">Colony readiness</h2>
        <span className="num text-[0.65rem] text-ink-faint">{scores.length} players</span>
      </div>
      {scores.length ? (
        <ol>
          {scores.map((score) => {
            const faction = getFaction(world, score.playerId);
            return (
              <PlayerRow
                key={score.playerId}
                accent={faction.accent}
                expanded={expandedId === score.playerId}
                glyph={faction.glyph}
                leading={score.total === best && scores.length > 1}
                score={score}
                share={score.total / best}
                onToggle={() => setExpandedId((current) => (current === score.playerId ? null : score.playerId))}
              />
            );
          })}
        </ol>
      ) : (
        <p className="px-1 pb-1 text-xs text-ink-faint">No players have entered this world.</p>
      )}
    </section>
  );
};

export { Scoreboard };
