import { describe, expect, it } from 'vitest';

import { formatScores } from '../src/match-files.js';

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
