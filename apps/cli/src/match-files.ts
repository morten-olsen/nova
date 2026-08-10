import { writeFile } from 'node:fs/promises';

import type { FinalScore } from '@morten-olsen/nova-match';

type RecordingFile = {
  playerId: string;
  rounds: number;
  scores: FinalScore[];
  recording: string;
};

/**
 * The artifact written under `recording` disclosure.
 *
 * Deliberately not a replayable game file. It holds what the player's own
 * Android wrote to its `recording` field plus the final scores, and nothing
 * else — no world, no events, no opponent script. Under this mode the Android's
 * own notes are the player's only account of the match, which is what makes
 * writing to `recording` a decision rather than an afterthought.
 */
const writeRecordingFile = async (path: string, file: RecordingFile): Promise<void> => {
  await writeFile(
    path,
    `${JSON.stringify(
      {
        version: 1,
        kind: 'android-recording',
        playerId: file.playerId,
        rounds: file.rounds,
        finalScores: file.scores,
        recording: file.recording,
      },
      null,
      2,
    )}\n`,
  );
};

/** Renders the final standing for the terminal, winner first. */
const formatScores = (scores: FinalScore[]): string[] => {
  const ranked = [...scores].sort((left, right) => right.total - left.total);
  return ranked.map((score, index) => `  ${index + 1}. ${score.playerName} — ${score.total} readiness`);
};

export type { RecordingFile };
export { formatScores, writeRecordingFile };
