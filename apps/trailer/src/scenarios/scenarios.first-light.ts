import type { World } from '@morten-olsen/nova-game';

import { auroraProspector } from './scenarios.scripts.ts';
import { composeRounds, createAndroidProgram, type Recording } from './scenarios.program.ts';
import { assertOneBuildingPerTile, createAndroid, createBuilding, createTiles } from './scenarios.world.ts';

/**
 * Act one: one Android, one charger, and a board nobody has looked at.
 *
 * Round 0 with nothing revealed, so the opening frame is genuinely dark rather
 * than dimmed — the reveal that follows is the game's own fog mechanic easing
 * open around a single walking piece, not an effect layered on in post.
 *
 * The arc is deliberately the smallest complete loop the game has: walk, find
 * loose material, collect it, put up a depot, bank the rest, tell everyone where
 * the pods are.
 */
const auroraId = 'player-aurora';

const width = 12;
const height = 9;

const initialWorld = (): World => {
  const buildings = [
    createBuilding({ id: 'aurora-charger-initial', initial: true, ownerId: auroraId, type: 'charger', x: 2, y: 6 }),
  ];
  assertOneBuildingPerTile(buildings);

  return {
    androids: [
      createAndroid({
        battery: 100,
        health: 100,
        id: 'android-1',
        ownerId: auroraId,
        scriptId: 'script-1',
        x: 2,
        y: 6,
      }),
    ],
    buildings,
    messages: [],
    players: [{ id: auroraId, name: 'Aurora Combine' }],
    round: 0,
    scripts: [{ content: auroraProspector, id: 'script-1', name: 'aurora-prospector', ownerId: auroraId }],
    tiles: createTiles({
      composition: {
        // Acid seep in the south-west, close enough to the landing site to read as
        // a threat but never on the Android's route.
        '4,7': { acid: 2 },
        '4,8': { acid: 1 },
        '5,7': { acid: 2 },
        '5,8': { acid: 3 },
        '6,8': { acid: 1 },
        // Ore vein running north-east, the reason to keep walking after act one.
        '8,2': { ore: 2 },
        '8,3': { ore: 1 },
        '9,2': { ore: 3, water: 1 },
        '9,3': { ore: 2 },
        '10,3': { ore: 3 },
        '10,4': { ore: 2, water: 1 },
        '11,3': { ore: 1 },
        // Hot ground in the far corner.
        '10,7': { radiation: 2 },
        '11,7': { radiation: 2 },
        '11,8': { radiation: 3 },
        '1,1': { water: 2 },
        '2,1': { water: 1 },
      },
      height,
      scattered: {
        // The pod field: a scatter of earth-launched material with one rich centre.
        '3,2': { metal: 2 },
        '5,4': { electronics: 2, metal: 8 },
        '6,3': { polymer: 3 },
        '6,4': { metal: 4 },
        '7,5': { electronics: 1, metal: 5 },
        '9,6': { metal: 3, polymer: 1 },
        '10,1': { electronics: 2 },
      },
      width,
    }),
  };
};

const events = () => {
  const prospector = createAndroidProgram('android-1', { x: 2, y: 6 });

  prospector
    // Out of the charger and north-east to the pod field.
    .walkTo({ x: 5, y: 6 })
    .walkTo({ x: 5, y: 4 })
    .collect()
    // Build one tile back, so the depot and the charger read as the start of a base.
    .walkTo({ x: 5, y: 5 })
    .build('depot', { metal: 6 })
    .continueBuild(2)
    .deposit()
    .broadcast('pod field at 5,4 — metal confirmed. depot up at 5,5.')
    // Second haul, to show the loop closing rather than a one-off.
    .walkTo({ x: 6, y: 4 })
    .collect()
    .walkTo({ x: 5, y: 5 })
    .deposit()
    // Walking on toward the ore vein as act one ends.
    .walkTo({ x: 6, y: 5 });

  return composeRounds([prospector]);
};

const firstLight = (): Recording => ({
  events: events(),
  initialWorld: initialWorld(),
  version: 1,
});

export { firstLight };
