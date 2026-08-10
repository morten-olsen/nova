import { readFile } from 'node:fs/promises';

import {
  createInviteCode,
  formatInviteCode,
  hostPlayerId,
  peerIdForCode,
  runHostMatch,
  type Disclosure,
  type FinalScore,
} from '@morten-olsen/nova-match';
import { createQuickJsScriptRunner } from '@morten-olsen/nova-script-runner';

import { writeGameFile } from './game-file.js';
import { writeRecordingFile } from './match-files.js';
import { createMatchHost } from './match-transport.js';

type HostMatchOptions = {
  disclosure: Disclosure;
  height: number;
  outputPath: string;
  playerName: string;
  /** Progress reporting, so this module does not write to the terminal itself. */
  report: (message: string) => void;
  rounds: number;
  scriptName: string;
  scriptPath: string;
  width: number;
};

type HostMatchResult = {
  outputPath: string;
  scores: FinalScore[];
};

const inviteBanner = (code: string, options: HostMatchOptions): string =>
  [
    '',
    `  Invite code:  ${formatInviteCode(code)}`,
    '',
    `  Rounds:       ${options.rounds}`,
    `  World:        ${options.width}x${options.height}`,
    `  Disclosure:   ${options.disclosure}`,
    '',
    'Share the invite code with the other player. They join with:',
    `  npx nova join ${formatInviteCode(code)} --script bot/<their-android>.js`,
    '',
    'or in the browser lab, from Match › Join.',
    '',
    'Waiting for a player to join. Press Ctrl+C to stop.',
  ].join('\n');

const hostGame = async (options: HostMatchOptions): Promise<HostMatchResult> => {
  const script = await readFile(options.scriptPath, 'utf8');

  const code = createInviteCode();
  const host = await createMatchHost(peerIdForCode(code));
  options.report(inviteBanner(code, options));

  const connection = await host.waitForGuest();

  try {
    const outcome = await runHostMatch({
      connection,
      disclosure: options.disclosure,
      height: options.height,
      playerName: options.playerName,
      report: options.report,
      rounds: options.rounds,
      script,
      scriptName: options.scriptName,
      scriptRunner: createQuickJsScriptRunner(),
      width: options.width,
    });

    if (outcome.game) {
      await writeGameFile(options.outputPath, outcome.game);
    } else {
      await writeRecordingFile(options.outputPath, {
        playerId: hostPlayerId,
        rounds: outcome.rounds,
        scores: outcome.scores,
        recording: outcome.recording ?? '',
      });
    }

    return { outputPath: options.outputPath, scores: outcome.scores };
  } finally {
    connection.close();
  }
};

export type { HostMatchOptions, HostMatchResult };
export { hostGame };
