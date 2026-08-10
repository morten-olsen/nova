import { calculateColonyScores, createBaseRuleset, Loop, type ScriptRunner, type World } from '@morten-olsen/nova-game';

import { guestPlayerId, hostPlayerId, type FinalScore } from './match-protocol.js';

type MatchWorldOptions = {
  guestName: string;
  height: number;
  hostName: string;
  scriptRunner: ScriptRunner;
  width: number;
};

/**
 * Both players are seeded into the world before it is built so that
 * `game.place-charger` hands them its starter positions and puts their initial
 * chargers in opposite corners. Letting each player be created lazily by their
 * first event instead — the way the single-player commands do it — would place
 * both chargers on the first open tile, next to each other.
 */
const createMatchWorld = (options: MatchWorldOptions): World =>
  new Loop({
    ruleset: createBaseRuleset({ world: { width: options.width, height: options.height } }),
    scriptRunner: options.scriptRunner,
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

const finalScoresOf = (world: World): FinalScore[] =>
  calculateColonyScores(world).map((score) => ({
    playerId: score.playerId,
    playerName: score.playerName,
    total: score.total,
  }));

/**
 * Everything a player's own Androids wrote to their `recording` field, which is
 * all that `recording` disclosure reveals to them.
 */
const androidRecordingFor = (world: World, ownerId: string): string =>
  world.androids
    .filter((android) => android.ownerId === ownerId)
    .map((android) => android.recording)
    .filter((recording) => recording.length > 0)
    .join('\n');

export type { MatchWorldOptions };
export { androidRecordingFor, createMatchWorld, finalScoresOf };
