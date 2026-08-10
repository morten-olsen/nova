import { Play, Trophy } from 'lucide-react';

import { Button } from '../ui/button.tsx';
import { cn } from '../ui/cn.ts';

import type { MatchResult } from './match-state.ts';

type MatchScoresProps = {
  onLoadReplay: () => void;
  result: MatchResult;
};

const MatchScores = ({ onLoadReplay, result }: MatchScoresProps): React.ReactNode => {
  const ranked = [...result.scores].sort((left, right) => right.total - left.total);
  const won = ranked[0]?.playerId === result.selfId;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-1 py-2">
        <Trophy className={cn('size-6', won ? 'text-energy' : 'text-ink-faint')} />
        <p className="text-sm font-semibold">{won ? 'You won' : 'You lost'}</p>
      </div>

      <ol className="flex flex-col gap-1">
        {ranked.map((score, index) => (
          <li
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm',
              score.playerId === result.selfId ? 'bg-panel-raised text-ink' : 'text-ink-dim',
            )}
            key={score.playerId}
          >
            <span className="num text-ink-faint">{index + 1}</span>
            <span className="min-w-0 flex-1 truncate">{score.playerName}</span>
            <span className="num font-semibold">{score.total}</span>
          </li>
        ))}
      </ol>

      {result.game ? (
        <Button onClick={onLoadReplay} variant="primary">
          <Play />
          Watch the replay
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          {/*
            Under `recording` disclosure there is no replay to load — this is
            the entire account of the match the player receives.
          */}
          <p className="label">Your android&rsquo;s recording</p>
          <pre className="num max-h-52 overflow-auto rounded-md border border-hairline bg-abyss p-3 text-xs whitespace-pre-wrap text-ink-dim">
            {result.recording?.trim() || 'Your android wrote nothing to its recording this match.'}
          </pre>
        </div>
      )}
    </div>
  );
};

export { MatchScores };
