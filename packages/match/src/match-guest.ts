import type { GameRecording } from '@morten-olsen/nova-game';

import type { MatchConnection } from './match-connection.js';
import {
  hostMessageSchema,
  protocolVersion,
  type Disclosure,
  type FinalScore,
  type OfferMessage,
} from './match-protocol.js';

type JoinMatchOptions = {
  /**
   * Decides whether to accept the host's terms. Called before the script is
   * sent anywhere, so declining costs the guest nothing.
   */
  confirm: (offer: OfferMessage) => Promise<boolean>;
  connection: MatchConnection;
  playerName: string;
  report: (message: string) => void;
  script: string;
  scriptName: string;
};

type JoinMatchOutcome = {
  disclosure: Disclosure;
  /** Present under `full` disclosure: a replayable, redacted recording. */
  game?: GameRecording;
  offer: OfferMessage;
  /** Present under `recording` disclosure: what the guest's own androids wrote. */
  recording?: string;
  scores: FinalScore[];
};

const receiveOffer = async (options: JoinMatchOptions): Promise<OfferMessage> => {
  const offer = hostMessageSchema.parse(await options.connection.receive());
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
  return offer;
};

/**
 * Joins a match over an already-connected channel.
 *
 * The guest never runs anything: it submits its Android and waits. That is why
 * the disclosure mode matters so much here, and why it is shown and confirmed
 * before the script leaves the machine.
 */
const runGuestMatch = async (options: JoinMatchOptions): Promise<JoinMatchOutcome> => {
  const { connection } = options;

  connection.send({ type: 'hello', protocol: protocolVersion, playerName: options.playerName });

  const offer = await receiveOffer(options);
  if (!(await options.confirm(offer))) {
    connection.send({ type: 'decline' });
    throw new Error('Match declined.');
  }

  connection.send({ type: 'accept', scriptName: options.scriptName, script: options.script });
  options.report(`Joined. ${offer.hostName} is running ${offer.rounds} rounds…`);

  // Progress messages arrive until the result does.
  for (;;) {
    const message = hostMessageSchema.parse(await connection.receive());

    if (message.type === 'progress') {
      options.report(`Round ${message.round}/${message.rounds}`);
      continue;
    }
    if (message.type === 'failed') {
      throw new Error(message.message);
    }
    if (message.type !== 'result') {
      throw new Error('The host sent an unexpected message.');
    }

    if (message.disclosure === 'full' && !message.game) {
      throw new Error('The host promised a full recording but did not send one.');
    }

    return {
      disclosure: message.disclosure,
      game: message.game,
      offer,
      recording: message.disclosure === 'recording' ? (message.recording ?? '') : undefined,
      scores: message.scores,
    };
  }
};

export type { JoinMatchOptions, JoinMatchOutcome };
export { runGuestMatch };
