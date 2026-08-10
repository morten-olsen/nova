import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

import { writeGameFile } from './game-file.js';
import { writeRecordingFile } from './match-files.js';
import {
  hostMessageSchema,
  normalizeInviteCode,
  peerIdForCode,
  protocolVersion,
  guestPlayerId,
  type FinalScore,
  type OfferMessage,
} from './match-protocol.js';
import { joinMatch } from './match-transport.js';

type JoinMatchOptions = {
  code: string;
  scriptPath: string;
  scriptName: string;
  playerName: string;
  /** An explicit `--out`; when absent the default depends on the host's disclosure mode. */
  outputPath?: string;
  resolveDefaultOutputPath: (disclosure: OfferMessage['disclosure']) => string;
  /** Skips the confirmation prompt, for non-interactive use. */
  assumeYes: boolean;
  report: (message: string) => void;
};

type JoinMatchResult = {
  outputPath: string;
  scores: FinalScore[];
  disclosure: OfferMessage['disclosure'];
};

const describeDisclosure = (disclosure: OfferMessage['disclosure']): string =>
  disclosure === 'full'
    ? [
        '    full — when the match ends, both players receive the complete',
        "    recording: every round, both Androids, and each other's script.",
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
    connection.send({ type: 'hello', protocol: protocolVersion, playerName: options.playerName });

    const offer = hostMessageSchema.parse(await connection.receive());
    if (offer.type === 'failed') {
      throw new Error(offer.message);
    }
    if (offer.type !== 'offer') {
      throw new Error('The host sent an unexpected message.');
    }
    if (offer.protocol !== protocolVersion) {
      throw new Error(
        `The host runs an incompatible Nova version (protocol ${offer.protocol}, expected ${protocolVersion}).`,
      );
    }

    const accepted = options.assumeYes || (await confirmOffer(offer, report));
    if (!accepted) {
      connection.send({ type: 'decline' });
      throw new Error('Match declined.');
    }

    connection.send({ type: 'accept', scriptName: options.scriptName, script });
    report(`Joined. ${offer.hostName} is running ${offer.rounds} rounds…`);

    // Progress messages arrive until the result does.
    for (;;) {
      const message = hostMessageSchema.parse(await connection.receive());

      if (message.type === 'progress') {
        report(`Round ${message.round}/${message.rounds}`);
        continue;
      }
      if (message.type === 'failed') {
        throw new Error(message.message);
      }
      if (message.type !== 'result') {
        throw new Error('The host sent an unexpected message.');
      }

      const outputPath = options.outputPath ?? options.resolveDefaultOutputPath(message.disclosure);

      if (message.disclosure === 'full') {
        if (!message.game) {
          throw new Error('The host promised a full recording but did not send one.');
        }
        await writeGameFile(outputPath, message.game);
      } else {
        await writeRecordingFile(outputPath, {
          playerId: guestPlayerId,
          rounds: offer.rounds,
          scores: message.scores,
          recording: message.recording ?? '',
        });
      }

      return { outputPath, scores: message.scores, disclosure: message.disclosure };
    }
  } finally {
    connection.close();
  }
};

export type { JoinMatchOptions, JoinMatchResult };
export { joinGame };
