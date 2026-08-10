import { calculateColonyScores, type PlayerScore, type World } from '@morten-olsen/nova-game/browser';

type ScoreboardProps = {
  world: World;
};

type PlayerScoreCardProps = {
  score: PlayerScore;
};

const PlayerScoreCard = ({ score }: PlayerScoreCardProps): React.ReactNode => {
  return (
    <li className="border-l-2 border-cyan-500/60 bg-slate-950/60 px-3 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium text-slate-100">{score.playerName}</span>
        <span className="text-lg font-bold text-cyan-200">{score.total}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">{score.playerId}</p>
      {score.contributors.length ? (
        <ul className="mt-3 space-y-1 border-t border-slate-800 pt-2 text-xs text-slate-300">
          {score.contributors.map((contributor) => (
            <li key={contributor.id} className="flex justify-between gap-3">
              <span>{contributor.label}</span>
              <span className="shrink-0 text-slate-400">
                {contributor.quantity} · {contributor.points}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 border-t border-slate-800 pt-2 text-xs text-slate-500">No viable colony assets yet.</p>
      )}
    </li>
  );
};

const Scoreboard = ({ world }: ScoreboardProps): React.ReactNode => {
  const scores = calculateColonyScores(world);
  return (
    <aside className="command-panel max-h-80 shrink-0 overflow-y-auto p-4 xl:max-h-[45%]">
      <div className="flex items-baseline justify-between gap-3">
        <p className="command-label text-cyan-300">Colony readiness</p>
        <span className="text-xs text-slate-500">score</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-400">Completed infrastructure and secured materials only.</p>
      {scores.length ? (
        <ol className="mt-3 space-y-2">
          {scores.map((score) => (
            <PlayerScoreCard key={score.playerId} score={score} />
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No players have entered this world.</p>
      )}
    </aside>
  );
};

export { Scoreboard };
