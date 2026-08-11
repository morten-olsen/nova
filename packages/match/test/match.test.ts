import { describe, expect, it } from 'vitest';
import type { ScriptRunner, World } from '@morten-olsen/nova-game';

import {
  androidRecordingFor,
  disclosureSchema,
  formatInviteCode,
  guestMessageSchema,
  hostMessageSchema,
  normalizeInviteCode,
  peerIdForCode,
  protocolVersion,
  runHostMatch,
  type MatchConnection,
} from '../src/nova-match.js';

const android = (id: string, ownerId: string, recording: string) => ({
  id,
  ownerId,
  scriptId: 'script-1',
  position: { x: 0, y: 0 },
  battery: 100,
  health: 100,
  active: true,
  memory: '',
  recording,
});

const worldWith = (androids: World['androids']): World => ({
  scripts: [],
  tiles: [],
  androids,
  buildings: [],
  players: [
    { id: 'player-1', name: 'alice' },
    { id: 'player-2', name: 'bob' },
  ],
  messages: [],
  round: 3,
});

describe('invite codes', () => {
  it('accepts a code as displayed, undashed, or in lower case', () => {
    const code = 'YF4D4MGZKE';

    expect(normalizeInviteCode('YF4D4-MGZKE')).toBe(code);
    expect(normalizeInviteCode('YF4D4MGZKE')).toBe(code);
    expect(normalizeInviteCode('yf4d4-mgzke')).toBe(code);
    expect(normalizeInviteCode('  YF4D4-MGZKE  ')).toBe(code);
  });

  it('rejects a code of the wrong length rather than connecting to nothing', () => {
    expect(() => normalizeInviteCode('YF4D4')).toThrow(/10 characters/);
    expect(() => normalizeInviteCode('')).toThrow(/10 characters/);
  });

  it('groups the code for display and derives a namespaced peer id', () => {
    expect(formatInviteCode('YF4D4MGZKE')).toBe('YF4D4-MGZKE');
    // Prefixed so codes stay short while not colliding with unrelated PeerJS apps.
    expect(peerIdForCode('YF4D4MGZKE')).toBe('nova-match-yf4d4mgzke');
  });
});

describe('android recordings', () => {
  it("returns only the requesting player's own recordings", () => {
    const world = worldWith([
      android('android-1', 'player-1', 'mine: round 1'),
      android('android-2', 'player-2', 'theirs: round 1'),
    ]);

    expect(androidRecordingFor(world, 'player-1')).toBe('mine: round 1');
    expect(androidRecordingFor(world, 'player-2')).toBe('theirs: round 1');
  });

  it("joins several of a player's androids and skips the silent ones", () => {
    const world = worldWith([
      android('android-1', 'player-1', 'first'),
      android('android-2', 'player-1', ''),
      android('android-3', 'player-1', 'third'),
    ]);

    expect(androidRecordingFor(world, 'player-1')).toBe('first\nthird');
  });

  it('is empty for a player whose android never wrote anything', () => {
    const world = worldWith([android('android-1', 'player-1', '')]);

    expect(androidRecordingFor(world, 'player-1')).toBe('');
  });
});

describe('match protocol', () => {
  it('only accepts the two disclosure modes', () => {
    expect(disclosureSchema.parse('full')).toBe('full');
    expect(disclosureSchema.parse('recording')).toBe('recording');
    expect(disclosureSchema.safeParse('partial').success).toBe(false);
  });

  it('rejects a peer message that is not part of the protocol', () => {
    expect(guestMessageSchema.safeParse({ type: 'run-arbitrary-thing' }).success).toBe(false);
    expect(hostMessageSchema.safeParse({ type: 'offer' }).success).toBe(false);
  });

  it('accepts a well-formed offer and accept pair', () => {
    expect(
      hostMessageSchema.parse({
        type: 'offer',
        protocol: 1,
        hostName: 'alice',
        rounds: 20,
        disclosure: 'recording',
        world: { width: 16, height: 16 },
      }).type,
    ).toBe('offer');

    expect(
      guestMessageSchema.parse({
        type: 'accept',
        scriptName: 'bot.js',
        script: '({ type: "android.wait" })',
      }).type,
    ).toBe('accept');
  });
});

const ignore = (): undefined => undefined;

/** A connection that answers with a scripted guest, so the host can be run alone. */
const scriptedGuest = (messages: unknown[]): MatchConnection => {
  const queue = [...messages];
  return {
    send: ignore,
    receive: () => Promise.resolve(queue.shift()),
    close: ignore,
  };
};

describe('hosting a match', () => {
  it('plays the offered round count as the human arrival both androids can read', async () => {
    const script = "({ type: 'android.wait' })";
    const arrivals: (number | undefined)[] = [];
    const scriptRunner: ScriptRunner = {
      execute: ({ androidId, rules, world }) => {
        arrivals.push(rules.match.finalRound ?? undefined, world.finalRound);
        return Promise.resolve({ type: 'android.wait', androidId });
      },
    };

    const outcome = await runHostMatch({
      connection: scriptedGuest([
        { type: 'hello', protocol: protocolVersion, playerName: 'bob' },
        { type: 'accept', scriptName: 'bob-bot', script },
      ]),
      disclosure: 'full',
      height: 6,
      playerName: 'alice',
      report: ignore,
      rounds: 3,
      script,
      scriptName: 'alice-bot',
      scriptRunner,
      width: 6,
    });

    // A peer match runs exactly the rounds the host offered and cannot be
    // continued, so that count is the arrival every turn is told about — in the
    // rules it is played under and in the world it is handed.
    expect(arrivals.length).toBeGreaterThan(0);
    expect(new Set(arrivals)).toEqual(new Set([3]));
    // And it survives into the recording, so a replay is scored and read as the
    // match that was played.
    expect(outcome.game?.rules.match.finalRound).toBe(3);
    expect(outcome.game?.initialWorld.finalRound).toBe(3);
  });
});
