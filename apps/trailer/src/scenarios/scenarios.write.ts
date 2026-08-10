import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { calculateColonyScores, createBaseRuleset, type World } from '@morten-olsen/nova-game';

import { colonyRace } from './scenarios.colony-race.ts';
import { firstLight } from './scenarios.first-light.ts';
import type { Recording } from './scenarios.program.ts';

/**
 * Generates the trailer recordings, replays each one through the real ruleset, and
 * writes them to `examples/games`.
 *
 * The replay is the point. A choreographed event stream is only footage of this
 * game if the game accepts it, so every recording is applied event by event here:
 * an Android that walks off the map, deposits into something it does not own, or
 * continues construction it cannot afford throws during generation instead of
 * quietly producing a still board three minutes into a render. The beat
 * assertions then pin the moments the trailer cuts to.
 */
type Frame = {
  round: number;
  world: World;
};

const replay = (recording: Recording, label: string): Frame[] => {
  const ruleset = createBaseRuleset();
  let world = structuredClone(recording.initialWorld);
  const frames: Frame[] = [{ round: world.round ?? 0, world }];

  for (const [index, event] of recording.events.entries()) {
    try {
      world = ruleset.applyEvents(world, [event]);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`${label}: event ${index} (${event.type}) was rejected: ${detail}`);
    }
    if (event.type === 'game.round-end') {
      frames.push({ round: world.round ?? frames.length, world });
    }
  }

  return frames;
};

const assert = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(`Beat assertion failed: ${message}`);
  }
};

const findBuilding = (world: World, id: string) => world.buildings.find((building) => building.id === id);

const acidTotal = (world: World): number =>
  world.tiles.reduce((total, tile) => total + (tile.composition.acid ?? 0), 0);

const checkFirstLight = (frames: Frame[]): void => {
  const last = frames.at(-1);
  const first = frames[0];
  assert(!!first && !!last, 'first-light produced frames');
  if (!first || !last) {
    return;
  }

  assert(
    first.world.tiles.every((tile) => (tile.revealedBy?.length ?? 0) === 0),
    'first-light opens with nothing revealed',
  );
  assert(
    frames.some((frame) => frame.world.tiles.some((tile) => (tile.revealedBy?.length ?? 0) > 0)),
    'first-light reveals ground once a round ends',
  );

  const depot = last.world.buildings.find((building) => building.type === 'depot');
  assert(!!depot, 'first-light finishes with a depot');
  assert(depot?.remainingConstruction.ticks === 0, 'the depot is completed');
  assert((depot?.storage?.metal ?? 0) >= 6, 'material was banked in the depot');
  assert(last.world.androids.length === 1, 'the prospector survives act one');
  assert(last.world.messages?.length === 1, 'the prospector broadcasts its find');
};

const checkColonyRace = (frames: Frame[]): void => {
  const first = frames[0];
  const last = frames.at(-1);
  assert(!!first && !!last, 'colony-race produced frames');
  if (!first || !last) {
    return;
  }

  const moduleDone = frames.findIndex(
    (frame) => findBuilding(frame.world, 'aurora-colony-module')?.remainingConstruction.ticks === 0,
  );
  assert(moduleDone > 0, 'the colony module completes during the recording');

  const scannerGone = frames.findIndex((frame) => !findBuilding(frame.world, 'aurora-scanner'));
  assert(scannerGone > 0, 'the scanner is salvaged during the recording');
  assert(scannerGone < moduleDone, 'the sabotage lands before the climax');

  const haulerGone = frames.findIndex((frame) => !frame.world.androids.some((a) => a.id === 'android-3'));
  assert(haulerGone > 0, 'the acid kills the hauler during the recording');
  assert(haulerGone < scannerGone, 'the hauler dies before the sabotage');

  assert(acidTotal(last.world) < acidTotal(first.world) - 7, 'the terraformer measurably clears the flats');
  assert(last.world.androids.length === 5, 'five of six Androids survive');

  const before = calculateColonyScores(first.world);
  const after = calculateColonyScores(last.world);
  const auroraBefore = before.find((score) => score.playerId === 'player-aurora')?.total ?? 0;
  const borealisBefore = before.find((score) => score.playerId === 'player-borealis')?.total ?? 0;
  const auroraAfter = after.find((score) => score.playerId === 'player-aurora')?.total ?? 0;
  const borealisAfter = after.find((score) => score.playerId === 'player-borealis')?.total ?? 0;

  // The score arc the trailer is built on: Aurora behind, then the module lands.
  assert(auroraBefore < borealisBefore, 'Aurora starts behind on readiness');
  assert(auroraAfter > borealisAfter, 'Aurora finishes ahead once the module is up');
};

const summarise = (label: string, frames: Frame[]): void => {
  const last = frames.at(-1);
  if (!last) {
    return;
  }
  const scores = calculateColonyScores(last.world)
    .map((score) => `${score.playerName} ${Math.round(score.total)}`)
    .join(', ');
  const rounds = `${frames[0]?.round ?? 0}–${last.round}`;
  console.log(`  ${label}: ${frames.length} frames, rounds ${rounds}, final readiness: ${scores}`);
};

const here = dirname(fileURLToPath(import.meta.url));
const gamesDirectory = resolve(here, '../../../../examples/games');

const write = (name: string, recording: Recording): void => {
  const target = resolve(gamesDirectory, `${name}.json`);
  writeFileSync(target, `${JSON.stringify(recording, null, 2)}\n`, 'utf8');
  console.log(`  wrote ${target}`);
};

const main = (): void => {
  console.log('Generating trailer recordings');

  const light = firstLight();
  const lightFrames = replay(light, 'first-light');
  checkFirstLight(lightFrames);
  summarise('trailer-first-light', lightFrames);
  write('trailer-first-light', light);

  const race = colonyRace();
  const raceFrames = replay(race, 'colony-race');
  checkColonyRace(raceFrames);
  summarise('trailer-colony-race', raceFrames);
  write('trailer-colony-race', race);

  console.log('All beats verified against the base ruleset.');
};

main();
