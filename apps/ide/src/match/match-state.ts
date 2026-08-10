import type { GameRecording } from '@morten-olsen/nova-game';
import type { FinalScore, OfferMessage } from '@morten-olsen/nova-match';

type MatchPhase = 'idle' | 'connecting' | 'waiting' | 'offered' | 'playing' | 'done' | 'error';

type MatchResult = {
  /** Present under `full` disclosure; feeds straight into the replay board. */
  game?: GameRecording;
  /** Present under `recording` disclosure: our own androids' notes. */
  recording?: string;
  scores: FinalScore[];
  /** Which player id we were, so the result can say whether we won. */
  selfId: string;
};

type MatchState = {
  /** Shown while hosting, for the other player to type in. */
  code?: string;
  error?: string;
  /** Set while a joined offer is awaiting the player's decision. */
  offer?: OfferMessage;
  phase: MatchPhase;
  progress?: { round: number; rounds: number };
  result?: MatchResult;
  status?: string;
};

export type { MatchPhase, MatchResult, MatchState };
