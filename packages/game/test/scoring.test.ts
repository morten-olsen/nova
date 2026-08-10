import { describe, expect, it } from 'vitest';

import { calculateColonyScores, colonyScoresSchema, type World } from '../src/nova-game.js';

const complete = { ticks: 0, resources: {} };

describe('colony scoring', () => {
  it('scores completed colony assets and secured materials with an inspectable breakdown', () => {
    const world: World = {
      scripts: [],
      tiles: [
        { position: { x: 0, y: 0 }, composition: { acid: 8 }, revealedBy: ['player-1'] },
        { position: { x: 1, y: 0 }, composition: { ore: 10 }, revealedBy: ['player-1'] },
      ],
      androids: [
        {
          id: 'android-1',
          ownerId: 'player-2',
          scriptId: 'script-1',
          position: { x: 0, y: 0 },
          battery: 100,
          health: 100,
          active: true,
        },
      ],
      buildings: [
        {
          id: 'module',
          ownerId: 'player-1',
          type: 'colony-module',
          position: { x: 0, y: 0 },
          remainingConstruction: complete,
        },
        {
          id: 'charger',
          ownerId: 'player-1',
          type: 'charger',
          position: { x: 1, y: 0 },
          remainingConstruction: complete,
        },
        {
          id: 'depot',
          ownerId: 'player-1',
          type: 'depot',
          position: { x: 2, y: 0 },
          storage: { metal: 4, water: 3 },
          remainingConstruction: complete,
        },
        {
          id: 'scanner',
          ownerId: 'player-1',
          type: 'scanner',
          position: { x: 3, y: 0 },
          remainingConstruction: complete,
        },
        {
          id: 'relay',
          ownerId: 'player-1',
          type: 'relay-tower',
          position: { x: 4, y: 0 },
          remainingConstruction: complete,
        },
        {
          id: 'unfinished',
          ownerId: 'player-1',
          type: 'extractor',
          position: { x: 5, y: 0 },
          remainingConstruction: { ticks: 1, resources: {} },
        },
      ],
      players: [
        { id: 'player-1', name: 'Ada' },
        { id: 'player-2', name: 'Babbage' },
      ],
    };

    const scores = calculateColonyScores(world);

    expect(scores).toEqual([
      {
        playerId: 'player-1',
        playerName: 'Ada',
        total: 1_079,
        contributors: [
          { id: 'colony-modules', label: 'Colony modules', quantity: 1, points: 1_000 },
          { id: 'secured-storage', label: 'Secured storage', quantity: 1, points: 40 },
          { id: 'power-and-android-capacity', label: 'Power and Android capacity', quantity: 1, points: 25 },
          { id: 'stored-metal', label: 'Stored metal', quantity: 4, points: 8 },
          { id: 'stored-water', label: 'Stored water', quantity: 3, points: 6 },
        ],
      },
      { playerId: 'player-2', playerName: 'Babbage', total: 0, contributors: [] },
    ]);
    expect(colonyScoresSchema.parse(scores)).toEqual(scores);
  });
});
