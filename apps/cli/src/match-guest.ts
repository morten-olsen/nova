import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import {
  guestPlayerId,
  normalizeInviteCode,
  peerIdForCode,
  runGuestMatch,
  type FinalScore,
  type OfferMessage,
} from '@morten-olsen/nova-match';

import { writeGameFile } from './game-file.js';
import { writeRecordingFile } from './match-files.js';
import { joinMatch } from './match-transport.js';

type JoinMatchOptions = {
  /** Skips the confirmation prompt, for non-interactive use. */
  assumeYes: boolean;
  code: string;
  /** An explicit `--out`; when absent the default depends on the host's disclosure mode. */
  outputPath?: string;
  playerName: string;
  report: (message: string) => void;
  resolveDefaultOutputPath: (disclosure: OfferMessage['disclosure']) => string;
  scriptName: string;
  scriptPath: string;
};

type JoinMatchResult = {
  disclosure: OfferMessage['disclosure'];
  outputPath: string;
  scores: FinalScore[];
};

const describeDisclosure = (disclosure: OfferMessage['disclosure']): string =>
  disclosure === 'full'
    ? [
        '    full — when the match ends, both players receive a replay:',
        '    every round and both Androids. Opponent script source, Android',
        '    memory, and Android recording are redacted.',
        '    Openable with `nova play`.',
      ].join('\n')
    : [
        '    recording — when the match ends, you receive only what your own',
        '    Android wrote to its `recording` field, plus the final scores.',
        "    You will not be able to replay the match or read the host's script.",
      ].join('\n');

/**
 * The terms are shown before the guest's script is sent anywhere, so declining
 * costs nothing. The host's disclosure choice is the important part: under
 * `recording` the guest gives up any replay of the match.
 */
const confirmOffer = async (offer: OfferMessage, report: (message: string) => void): Promise<boolean> => {
  report(
    [
      '',
      'You have been invited to a Nova match:',
      '',
      `  Host:         ${offer.hostName}`,
      `  Rounds:       ${offer.rounds}`,
      `  World:        ${offer.world.width}x${offer.world.height}`,
      `  Disclosure:`,
      describeDisclosure(offer.disclosure),
      '',
      'Your Android script will be sent to the host, who runs the simulation.',
      '',
    ].join('\n'),
  );

  if (!stdin.isTTY) {
    throw new Error('Accepting a match needs an interactive terminal. Re-run with --yes to accept automatically.');
  }

  const prompt = createInterface({ input: stdin, output: stdout });
  const answer = await prompt.question('Join this match? [y/N] ');
  prompt.close();

  return /^y(es)?$/i.test(answer.trim());
};

const joinGame = async (options: JoinMatchOptions): Promise<JoinMatchResult> => {
  const { report } = options;
  const code = normalizeInviteCode(options.code);
  const script = await readFile(options.scriptPath, 'utf8');

  report('Connecting to the host…');
  const connection = await joinMatch(peerIdForCode(code));

  try {
    const outcome = await runGuestMatch({
      confirm: (offer) => (options.assumeYes ? Promise.resolve(true) : confirmOffer(offer, report)),
      connection,
      playerName: options.playerName,
      report,
      script,
      scriptName: options.scriptName,
    });

    const outputPath = options.outputPath ?? options.resolveDefaultOutputPath(outcome.disclosure);

    if (outcome.game) {
      await writeGameFile(outputPath, outcome.game);
    } else {
      await writeRecordingFile(outputPath, {
        playerId: guestPlayerId,
        rounds: outcome.offer.rounds,
        scores: outcome.scores,
        recording: outcome.recording ?? '',
      });
    }

    return { disclosure: outcome.disclosure, outputPath, scores: outcome.scores };
  } finally {
    connection.close();
  }
};

export type { JoinMatchOptions, JoinMatchResult };
export { joinGame };
