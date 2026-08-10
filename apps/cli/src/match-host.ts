import { readFile } from 'node:fs/promises';

import { createBaseRuleset, Loop, type Event, type World } from '@morten-olsen/nova-game';

import { createGameFile, writeGameFile, type GameFile } from './game-file.js';
import { androidRecordingFor, finalScoresOf, writeRecordingFile } from './match-files.js';
import {
  createInviteCode,
  formatInviteCode,
  guestMessageSchema,
  guestPlayerId,
  hostPlayerId,
  peerIdForCode,
  protocolVersion,
  type Disclosure,
  type FinalScore,
} from './match-protocol.js';
import { createMatchHost, type MatchConnection } from './match-transport.js';

type HostMatchOptions = {
  scriptPath: string;
  scriptName: string;
  playerName: string;
  rounds: number;
  width: number;
  height: number;
  disclosure: Disclosure;
  outputPath: string;
  /** Progress reporting, so this module does not write to the terminal itself. */
  report: (message: string) => void;
};

type HostMatchResult = {
  outputPath: string;
  scores: FinalScore[];
};

/**
 * Both players are seeded into the world before it is built so that
 * `game.place-charger` hands them its starter positions and puts their initial
 * chargers in opposite corners. Letting each player be created lazily by their
 * first event instead — the way the single-player commands do it — would place
 * both chargers on the first open tile, next to each other.
 */
const createMatchWorld = (options: { hostName: string; guestName: string; width: number; height: number }): World =>
  new Loop({
    ruleset: createBaseRuleset({ world: { width: options.width, height: options.height } }),
    initWorld: {
      tiles: [],
      scripts: [],
      androids: [],
      buildings: [],
      players: [
        { id: hostPlayerId, name: options.hostName },
        { id: guestPlayerId, name: options.guestName },
      ],
      messages: [],
      round: 0,
    },
  }).world;

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
    'Waiting for a player to join. Press Ctrl+C to stop.',
  ].join('\n');

type GuestEntry = {
  playerName: string;
  scriptName: string;
  script: string;
};

/**
 * Exchanges the greeting and the offer, and returns the guest's Android once
 * they have accepted. Throws if they decline, so the caller never has to treat
 * a declined match as a special kind of success.
 */
const negotiate = async (connection: MatchConnection, options: HostMatchOptions): Promise<GuestEntry> => {
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

  return {
    playerName: hello.playerName,
    scriptName: reply.scriptName,
    script: reply.script,
  };
};

/** Runs the whole match on the host, reporting each round to the guest as it lands. */
const simulate = async (
  connection: MatchConnection,
  options: HostMatchOptions,
  guest: GuestEntry,
  hostScript: string,
): Promise<{ world: World; gameFile: GameFile }> => {
  const initialWorld = createMatchWorld({
    hostName: options.playerName,
    guestName: guest.playerName,
    width: options.width,
    height: options.height,
  });
  const loop = new Loop({ ruleset: createBaseRuleset(), initWorld: initialWorld });

  const setup: Event[] = [
    {
      type: 'user.upload-android-script',
      ownerId: hostPlayerId,
      name: options.scriptName,
      content: hostScript,
    },
    {
      type: 'user.upload-android-script',
      ownerId: guestPlayerId,
      name: guest.scriptName,
      content: guest.script,
    },
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

  return {
    world: loop.world,
    gameFile: { ...createGameFile(initialWorld), events: loop.events },
  };
};

/**
 * Sends the guest their side of the disclosure and writes the host's own.
 *
 * The host is restricted exactly as the guest is: under `recording` it keeps
 * only its own Android's notes, so running the simulation is not an information
 * advantage even though the full world passed through this process.
 */
const deliverResult = async (
  connection: MatchConnection,
  options: HostMatchOptions,
  world: World,
  gameFile: GameFile,
): Promise<FinalScore[]> => {
  const scores = finalScoresOf(world);

  if (options.disclosure === 'full') {
    connection.send({ type: 'result', disclosure: 'full', scores, game: gameFile });
    await writeGameFile(options.outputPath, gameFile);
  } else {
    connection.send({
      type: 'result',
      disclosure: 'recording',
      scores,
      recording: androidRecordingFor(world, guestPlayerId),
    });
    await writeRecordingFile(options.outputPath, {
      playerId: hostPlayerId,
      rounds: options.rounds,
      scores,
      recording: androidRecordingFor(world, hostPlayerId),
    });
  }

  return scores;
};

const resultFlushMs = 1_500;

const hostGame = async (options: HostMatchOptions): Promise<HostMatchResult> => {
  const hostScript = await readFile(options.scriptPath, 'utf8');

  const code = createInviteCode();
  const host = await createMatchHost(peerIdForCode(code));
  options.report(inviteBanner(code, options));

  const connection = await host.waitForGuest();

  try {
    const guest = await negotiate(connection, options);
    options.report(`${guest.playerName} accepted with "${guest.scriptName}". Running ${options.rounds} rounds…`);

    const { world, gameFile } = await simulate(connection, options, guest, hostScript);
    const scores = await deliverResult(connection, options, world, gameFile);

    // Give the result time to reach the guest before the channel is torn down.
    await new Promise((resolve) => setTimeout(resolve, resultFlushMs));

    return { outputPath: options.outputPath, scores };
  } finally {
    connection.close();
  }
};

export type { HostMatchOptions, HostMatchResult };
export { hostGame };
