import {
  createInviteCode,
  formatInviteCode,
  guestPlayerId,
  hostPlayerId,
  normalizeInviteCode,
  peerIdForCode,
  runGuestMatch,
  runHostMatch,
  type Disclosure,
  type OfferMessage,
} from '@morten-olsen/nova-match';

import { getScriptRunner } from '../runner/script-runner.ts';

import { createMatchHost, joinMatch } from './peer-transport.ts';
import type { MatchResult } from './match-state.ts';

type FlowHandlers = {
  /** Called with the invite code once it is registered and usable. */
  onCode: (code: string) => void;
  onDone: (result: MatchResult) => void;
  /** Asks the player to accept the host's terms. */
  onOffer: (offer: OfferMessage) => Promise<boolean>;
  onReport: (message: string) => void;
  /** Hands back a teardown for whatever has been opened so far. */
  onTeardown: (close: () => void) => void;
};

type HostFlowOptions = {
  disclosure: Disclosure;
  playerName: string;
  rounds: number;
  script: string;
  scriptName: string;
  size: number;
};

type JoinFlowOptions = {
  code: string;
  playerName: string;
  script: string;
  scriptName: string;
};

/**
 * Hosts a match from the browser.
 *
 * The host runs both androids, including the opponent's, through the same
 * QuickJS sandbox the Run button uses — so a hostile opponent script is bounded
 * by the same per-turn CPU, memory and stack limits rather than being trusted.
 */
const startHosting = async (options: HostFlowOptions, handlers: FlowHandlers): Promise<void> => {
  const code = createInviteCode();
  const peerHost = await createMatchHost(peerIdForCode(code));
  handlers.onTeardown(() => peerHost.close());
  handlers.onCode(formatInviteCode(code));

  const connection = await peerHost.waitForGuest();
  handlers.onTeardown(() => connection.close());

  const outcome = await runHostMatch({
    connection,
    disclosure: options.disclosure,
    height: options.size,
    playerName: options.playerName,
    report: handlers.onReport,
    rounds: options.rounds,
    script: options.script,
    scriptName: options.scriptName,
    scriptRunner: getScriptRunner(),
    width: options.size,
  });

  connection.close();
  handlers.onDone({
    game: outcome.game,
    recording: outcome.recording,
    scores: outcome.scores,
    selfId: hostPlayerId,
  });
};

/** Joins a match, from either a browser or a terminal host. */
const startJoining = async (options: JoinFlowOptions, handlers: FlowHandlers): Promise<void> => {
  const code = normalizeInviteCode(options.code);
  const connection = await joinMatch(peerIdForCode(code));
  handlers.onTeardown(() => connection.close());

  const outcome = await runGuestMatch({
    confirm: handlers.onOffer,
    connection,
    playerName: options.playerName,
    report: handlers.onReport,
    script: options.script,
    scriptName: options.scriptName,
  });

  connection.close();
  handlers.onDone({
    game: outcome.game,
    recording: outcome.recording,
    scores: outcome.scores,
    selfId: guestPlayerId,
  });
};

export type { FlowHandlers, HostFlowOptions, JoinFlowOptions };
export { startHosting, startJoining };
