import { calculateColonyScores, Loop, type Ruleset, type ScriptRunner, type World } from '@morten-olsen/nova-game';

import { guestPlayerId, hostPlayerId, type FinalScore } from './match-protocol.js';

type MatchWorldOptions = {
  guestName: string;
  hostName: string;
  /** The same ruleset the match is then played with, so the world and the play agree. */
  ruleset: Ruleset;
  scriptRunner: ScriptRunner;
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
    ruleset: options.ruleset,
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

const finalScoresOf = (world: World, ruleset: Ruleset): FinalScore[] =>
  calculateColonyScores(world, ruleset.rules).map((score) => ({
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
