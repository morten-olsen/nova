import { calculateColonyScores, createTimeline, parseRecording, type TimelineFrame } from '@morten-olsen/nova-game';

/** What the telemetry panel shows for one round of the recording. */
type BoardReadout = {
  androids: number;
  /** Highest colony readiness on the board, which is what the game scores by. */
  readiness: number;
  round: number;
  structures: number;
};

type BoardTimeline = {
  frames: TimelineFrame[];
  readAt: (index: number) => BoardReadout;
};

/**
 * Replays a committed recording into frames the board can step through.
 *
 * The recording, the timeline and the readiness numbers are the same ones the
 * CLI and the replay viewer use, so nothing on this page is a mock-up of the
 * game: it is the game, played back.
 */
const loadBoardTimeline = async (url: string, signal: AbortSignal): Promise<BoardTimeline> => {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Could not load the board recording (${String(response.status)})`);
  }

  const recording = parseRecording(await response.text());
  const frames = createTimeline(recording);
  if (frames.length === 0) {
    throw new Error('The board recording replayed to no frames');
  }

  const readAt = (index: number): BoardReadout => {
    const frame = frames[Math.min(index, frames.length - 1)];
    if (!frame) {
      throw new Error(`No frame at index ${String(index)}`);
    }
    const scores = calculateColonyScores(frame.world, recording.rules);
    return {
      androids: frame.world.androids.length,
      readiness: Math.max(0, ...scores.map((score) => score.total)),
      round: frame.round,
      structures: frame.world.buildings.filter((building) => building.remainingConstruction.ticks === 0).length,
    };
  };

  return { frames, readAt };
};

export type { BoardReadout, BoardTimeline };
export { loadBoardTimeline };
