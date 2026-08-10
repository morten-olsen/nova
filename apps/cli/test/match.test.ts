import { describe, expect, it } from 'vitest';
import type { World } from '@morten-olsen/nova-game';

import { androidRecordingFor, formatScores } from '../src/match-files.js';
import {
  disclosureSchema,
  formatInviteCode,
  guestMessageSchema,
  hostMessageSchema,
  normalizeInviteCode,
  peerIdForCode,
} from '../src/match-protocol.js';

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

describe('final standing', () => {
  it('ranks the winner first regardless of player order', () => {
    expect(
      formatScores([
        { playerId: 'player-1', playerName: 'alice', total: 25 },
        { playerId: 'player-2', playerName: 'bob', total: 80 },
      ]),
    ).toEqual(['  1. bob — 80 readiness', '  2. alice — 25 readiness']);
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
