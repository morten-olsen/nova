import {
  createBaseRuleset,
  Loop,
  projectRecordingForPlayer,
  type Event,
  type GameRecording,
  type ScriptRunner,
  type World,
} from '@morten-olsen/nova-game';

import type { MatchConnection } from './match-connection.js';
import {
  guestMessageSchema,
  guestPlayerId,
  hostPlayerId,
  protocolVersion,
  type Disclosure,
  type FinalScore,
} from './match-protocol.js';
import { androidRecordingFor, createMatchWorld, finalScoresOf } from './match-world.js';

type HostMatchOptions = {
  connection: MatchConnection;
  disclosure: Disclosure;
  height: number;
  playerName: string;
  /** Progress reporting, so this module talks to neither a terminal nor a DOM. */
  report: (message: string) => void;
  rounds: number;
  script: string;
  scriptName: string;
  scriptRunner: ScriptRunner;
  width: number;
};

/** What the host keeps. The caller decides whether that means a file or a screen. */
type HostMatchOutcome = {
  disclosure: Disclosure;
  /** Present under `full` disclosure: the host's own redacted replay. */
  game?: GameRecording;
  guestName: string;
  /** Present under `recording` disclosure: what the host's own androids wrote. */
  recording?: string;
  rounds: number;
  scores: FinalScore[];
};

type GuestEntry = {
  playerName: string;
  script: string;
  scriptName: string;
};

/**
 * Exchanges the greeting and the offer, and returns the guest's Android once
 * they have accepted. Throws if they decline, so the caller never has to treat
 * a declined match as a special kind of success.
 */
const negotiate = async (options: HostMatchOptions): Promise<GuestEntry> => {
  const { connection } = options;
  const hello = guestMessageSchema.parse(await connection.receive());
  if (hello.type !== 'hello') {
    throw new Error('The joining player sent an unexpected message.');
  }
  if (hello.protocol !== protocolVersion) {
    connection.send({
      type: 'failed',
      message: `The host speaks protocol ${protocolVersion} and you speak ${hello.protocol}. Both players need the same Nova version.`,
    });
    throw new Error(
      `${hello.playerName} runs an incompatible Nova version (protocol ${hello.protocol}, expected ${protocolVersion}).`,
    );
  }

  options.report(`${hello.playerName} is asking to join. Waiting for them to accept the terms…`);

  connection.send({
    type: 'offer',
    protocol: protocolVersion,
    hostName: options.playerName,
    rounds: options.rounds,
    disclosure: options.disclosure,
    world: { width: options.width, height: options.height },
  });

  const reply = guestMessageSchema.parse(await connection.receive());
  if (reply.type === 'decline') {
    throw new Error(
      reply.reason
        ? `${hello.playerName} declined the match: ${reply.reason}`
        : `${hello.playerName} declined the match.`,
    );
  }
  if (reply.type !== 'accept') {
    throw new Error('The joining player sent an unexpected message.');
  }

  return { playerName: hello.playerName, script: reply.script, scriptName: reply.scriptName };
};

/** Runs the whole match on the host, reporting each round to the guest as it lands. */
const simulate = async (
  options: HostMatchOptions,
  guest: GuestEntry,
): Promise<{ game: GameRecording; world: World }> => {
  const { connection, scriptRunner } = options;
  const initialWorld = createMatchWorld({
    guestName: guest.playerName,
    height: options.height,
    hostName: options.playerName,
    scriptRunner,
    width: options.width,
  });
  const loop = new Loop({ ruleset: createBaseRuleset(), initWorld: initialWorld, scriptRunner });

  const setup: Event[] = [
    { type: 'user.upload-android-script', ownerId: hostPlayerId, name: options.scriptName, content: options.script },
    { type: 'user.upload-android-script', ownerId: guestPlayerId, name: guest.scriptName, content: guest.script },
  ];
  loop.applyEvents(setup);

  // Script ids are assigned in upload order, so the two uploads above become
  // script-1 for the host and script-2 for the guest.
  loop.applyEvents([
    { type: 'user.launch-android', ownerId: hostPlayerId, scriptId: 'script-1' },
    { type: 'user.launch-android', ownerId: guestPlayerId, scriptId: 'script-2' },
  ]);

  for (let round = 1; round <= options.rounds; round += 1) {
    await loop.run();
    connection.send({ type: 'progress', round, rounds: options.rounds });
  }

  return { game: { version: 1, initialWorld, events: loop.events }, world: loop.world };
};

/**
 * Sends the guest their side of the disclosure and returns the host's own.
 *
 * Under `full`, each player receives a renderable replay with the other
 * player's executable and persisted Android state redacted. Under `recording`,
 * each player keeps only its own Android's notes.
 */
const deliverResult = (
  options: HostMatchOptions,
  game: GameRecording,
  world: World,
): Omit<HostMatchOutcome, 'guestName'> => {
  const { connection } = options;
  const scores = finalScoresOf(world);
  const shared = { disclosure: options.disclosure, rounds: options.rounds, scores };

  if (options.disclosure === 'full') {
    connection.send({
      type: 'result',
      disclosure: 'full',
      scores,
      game: projectRecordingForPlayer(game, guestPlayerId),
    });
    return { ...shared, game: projectRecordingForPlayer(game, hostPlayerId) };
  }

  connection.send({
    type: 'result',
    disclosure: 'recording',
    scores,
    recording: androidRecordingFor(world, guestPlayerId),
  });
  return { ...shared, recording: androidRecordingFor(world, hostPlayerId) };
};

const resultFlushMs = 1_500;

/**
 * Hosts a match over an already-connected channel.
 *
 * The caller owns the transport and the invite code, because registering the
 * code has to happen before the code can be shown — and the host is the one
 * that has to show it.
 */
const runHostMatch = async (options: HostMatchOptions): Promise<HostMatchOutcome> => {
  const guest = await negotiate(options);
  options.report(`${guest.playerName} accepted with "${guest.scriptName}". Running ${options.rounds} rounds…`);

  const { game, world } = await simulate(options, guest);
  const outcome = deliverResult(options, game, world);

  // Give the result time to reach the guest before the channel is torn down.
  await new Promise((resolve) => setTimeout(resolve, resultFlushMs));

  return { ...outcome, guestName: guest.playerName };
};

export type { HostMatchOptions, HostMatchOutcome };
export { runHostMatch };
