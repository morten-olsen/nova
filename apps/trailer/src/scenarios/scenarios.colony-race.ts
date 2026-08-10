import type { Building, World } from '@morten-olsen/nova-game';

import {
  auroraColonyCrew,
  auroraHauler,
  auroraProspector,
  borealisReclaimer,
  borealisSupply,
  borealisTerraformer,
} from './scenarios.scripts.ts';
import { colonyRacePrograms } from './scenarios.colony-race.programs.ts';
import { composeRounds, type Recording } from './scenarios.program.ts';
import {
  assertOneBuildingPerTile,
  createAndroid,
  createBuilding,
  createTiles,
  type BoardSpec,
} from './scenarios.world.ts';

/**
 * Act two: round 46, two colony programmes, and an acid plain between them.
 *
 * Borealis is ahead on readiness — three chargers, an acid plant and a fuller
 * depot — and Aurora has spent everything on one bet standing eight ticks from
 * finished at 6,6. The recording runs the twenty rounds in which that bet pays.
 */
const aurora = 'player-aurora';
const borealis = 'player-borealis';

const width = 16;
const height = 12;

/**
 * The acid flats are the board's central fact: they separate the two colonies,
 * they are the only thing on it that kills, and they are the one hazard a player
 * can remove. Values run deepest through the middle so the pool reads as a body
 * with a shape rather than a uniform stain.
 */
const board: BoardSpec = {
  composition: {
    '10,7': { acid: 1 },
    '10,8': { acid: 2 },
    '7,7': { acid: 2 },
    '7,8': { acid: 1 },
    '8,7': { acid: 3 },
    '8,8': { acid: 3 },
    '8,9': { acid: 1 },
    '9,7': { acid: 3 },
    '9,8': { acid: 3 },
    '9,9': { acid: 1 },
    // Aurora's ore, under and around their extractor.
    '3,11': { ore: 1 },
    '4,10': { ore: 3, water: 1 },
    '4,11': { ore: 2 },
    '5,10': { ore: 2 },
    '5,11': { ore: 1 },
    // Borealis's ore, under and around theirs.
    '10,1': { ore: 2 },
    '11,0': { ore: 2 },
    '11,1': { ore: 3, water: 1 },
    '12,1': { ore: 1 },
    // Radiated ridge in the south-east: hot, and worth nothing.
    '13,8': { radiation: 2 },
    '13,9': { radiation: 2 },
    '14,8': { radiation: 2 },
    '14,9': { radiation: 3 },
    '15,9': { radiation: 1 },
    '1,2': { water: 2 },
    '2,2': { water: 1 },
  },
  height,
  scattered: {
    '12,8': { electronics: 3, metal: 6 },
    '6,9': { metal: 3 },
    '7,4': { electronics: 2, metal: 5 },
    '8,3': { polymer: 4 },
    '9,2': { metal: 4 },
    '1,5': { metal: 2, polymer: 1 },
    '14,10': { electronics: 1 },
  },
  width,
};

const auroraBuildings = (): Building[] => [
  createBuilding({ id: 'aurora-charger-initial', initial: true, ownerId: aurora, type: 'charger', x: 2, y: 9 }),
  createBuilding({ id: 'aurora-charger-north', ownerId: aurora, type: 'charger', x: 3, y: 10 }),
  createBuilding({ id: 'aurora-charger-west', ownerId: aurora, type: 'charger', x: 1, y: 9 }),
  createBuilding({
    id: 'aurora-depot-main',
    ownerId: aurora,
    storage: { electronics: 9, metal: 24, ore: 12, polymer: 6, water: 4 },
    type: 'depot',
    x: 2,
    y: 8,
  }),
  createBuilding({
    id: 'aurora-depot-west',
    ownerId: aurora,
    storage: { metal: 12, polymer: 4 },
    type: 'depot',
    x: 1,
    y: 10,
  }),
  createBuilding({
    id: 'aurora-extractor',
    ownerId: aurora,
    storage: { ore: 6, water: 2 },
    type: 'extractor',
    x: 4,
    y: 10,
  }),
  createBuilding({
    id: 'aurora-processor',
    ownerId: aurora,
    storage: { metal: 3, ore: 8 },
    type: 'processor',
    x: 3,
    y: 8,
  }),
  // Left at 22 health so three hostile salvages finish it: sabotage that pays off
  // inside the recording rather than a chip that goes nowhere.
  createBuilding({ health: 22, id: 'aurora-scanner', ownerId: aurora, type: 'scanner', x: 5, y: 8 }),
  createBuilding({ construction: 8, id: 'aurora-colony-module', ownerId: aurora, type: 'colony-module', x: 6, y: 6 }),
];

const borealisBuildings = (): Building[] => [
  createBuilding({ id: 'borealis-charger-initial', initial: true, ownerId: borealis, type: 'charger', x: 13, y: 2 }),
  createBuilding({ id: 'borealis-charger-east', ownerId: borealis, type: 'charger', x: 14, y: 1 }),
  createBuilding({ id: 'borealis-charger-south', ownerId: borealis, type: 'charger', x: 12, y: 2 }),
  createBuilding({
    id: 'borealis-depot-main',
    ownerId: borealis,
    storage: { electronics: 14, metal: 30, ore: 6, polymer: 10 },
    type: 'depot',
    x: 13,
    y: 3,
  }),
  createBuilding({
    id: 'borealis-depot-east',
    ownerId: borealis,
    storage: { electronics: 6, metal: 8 },
    type: 'depot',
    x: 15,
    y: 3,
  }),
  createBuilding({
    id: 'borealis-extractor',
    ownerId: borealis,
    storage: { ore: 9, water: 1 },
    type: 'extractor',
    x: 11,
    y: 1,
  }),
  createBuilding({
    id: 'borealis-processor',
    ownerId: borealis,
    storage: { metal: 5, ore: 10 },
    type: 'processor',
    x: 12,
    y: 3,
  }),
  createBuilding({
    id: 'borealis-acid-plant',
    ownerId: borealis,
    storage: { acidCanister: 5 },
    type: 'acid-processing-plant',
    x: 14,
    y: 4,
  }),
  createBuilding({ id: 'borealis-radar', ownerId: borealis, type: 'radar', x: 12, y: 5 }),
  createBuilding({ id: 'borealis-relay', ownerId: borealis, type: 'relay-tower', x: 14, y: 2 }),
];

const androids = () => [
  createAndroid({ battery: 62, health: 88, id: 'android-1', ownerId: aurora, scriptId: 'script-1', x: 6, y: 11 }),
  createAndroid({
    battery: 48,
    cargo: { ore: 4 },
    health: 74,
    id: 'android-2',
    ownerId: aurora,
    scriptId: 'script-3',
    x: 5,
    y: 11,
  }),
  createAndroid({
    battery: 55,
    cargo: { metal: 2 },
    // Forty-six rounds of crossing the flats on a script that never checked them.
    health: 5.2,
    id: 'android-3',
    ownerId: aurora,
    recording: 'r31 crossed flats, -3.0 hull\nr38 crossed flats, -4.5 hull\nr44 route unchanged',
    scriptId: 'script-2',
    x: 4,
    y: 5,
  }),
  createAndroid({ battery: 71, health: 91, id: 'android-4', ownerId: borealis, scriptId: 'script-4', x: 9, y: 10 }),
  createAndroid({ battery: 80, health: 95, id: 'android-5', ownerId: borealis, scriptId: 'script-5', x: 13, y: 6 }),
  createAndroid({ battery: 66, health: 84, id: 'android-6', ownerId: borealis, scriptId: 'script-6', x: 12, y: 8 }),
];

const initialWorld = (): World => {
  const buildings = [...auroraBuildings(), ...borealisBuildings()];
  assertOneBuildingPerTile(buildings);

  return {
    androids: androids(),
    buildings,
    messages: [
      {
        content: 'aurora is massing at 6,6. that is not a depot.',
        id: 'message-1',
        ownerId: borealis,
        position: { x: 9, y: 10 },
        round: 45,
        senderAndroidId: 'android-4',
      },
      {
        content: 'hold the corridor. eight ticks left.',
        id: 'message-2',
        ownerId: aurora,
        position: { x: 5, y: 11 },
        round: 45,
        senderAndroidId: 'android-2',
      },
    ],
    // Seat order is faction order: Aurora reads cyan, Borealis fuchsia.
    players: [
      { id: aurora, name: 'Aurora Combine' },
      { id: borealis, name: 'Borealis Works' },
    ],
    round: 46,
    scripts: [
      { content: auroraColonyCrew, id: 'script-1', name: 'aurora-colony-crew', ownerId: aurora },
      { content: auroraHauler, id: 'script-2', name: 'aurora-hauler', ownerId: aurora },
      { content: auroraProspector, id: 'script-3', name: 'aurora-prospector', ownerId: aurora },
      { content: borealisReclaimer, id: 'script-4', name: 'borealis-reclaimer', ownerId: borealis },
      { content: borealisTerraformer, id: 'script-5', name: 'borealis-terraformer', ownerId: borealis },
      { content: borealisSupply, id: 'script-6', name: 'borealis-supply', ownerId: borealis },
    ],
    tiles: createTiles(board),
  };
};

const colonyRace = (): Recording => ({
  events: composeRounds(colonyRacePrograms()),
  initialWorld: initialWorld(),
  version: 1,
});

export { colonyRace };
