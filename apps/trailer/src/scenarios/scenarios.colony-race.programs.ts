import { type AndroidProgram, createAndroidProgram } from './scenarios.program.ts';

/**
 * Twenty rounds of two colonies, choreographed so the beats the trailer needs
 * fall on known rounds. Every route is written waypoint by waypoint because
 * `walkTo` steps x before y, and the shortest path across this board runs
 * straight through the acid flats.
 *
 * Round numbers below are rounds of the recording, not world rounds; the world
 * starts at 46.
 */

/**
 * Aurora's colony crew. Puts the module up on round 14 — the film's climax.
 *
 * It then steps off the tile, which matters for more than tidiness: pieces
 * sharing a tile are scaled down and offset to fit, so a crew standing on its own
 * finished building renders the hero piece of the game at two-thirds size. Walking
 * away gives the module the tile, and the trailer a shot of it at full scale.
 */
const colonyCrew = (): AndroidProgram =>
  createAndroidProgram('android-1', { x: 6, y: 11 })
    .walkTo({ x: 6, y: 6 })
    .continueBuild(3)
    .broadcast('colony module 6,6 — five ticks out. hold the corridor.')
    .continueBuild(5)
    .broadcast('colony module online. aurora holds the plain.')
    .walkTo({ x: 6, y: 7 })
    .walkTo({ x: 5, y: 7 })
    .wait(3);

/**
 * Aurora's supply run: bank the ore, top up on the charger, then push a forward
 * depot out to the module so the corridor has somewhere to unload.
 */
const auroraSupply = (): AndroidProgram =>
  createAndroidProgram('android-2', { x: 5, y: 11 })
    .walkTo({ x: 3, y: 11 })
    .walkTo({ x: 3, y: 10 })
    .charge()
    .walkTo({ x: 3, y: 8 })
    .deposit()
    .walkTo({ x: 2, y: 8 })
    .withdraw({ metal: 8 })
    .walkTo({ x: 6, y: 8 })
    .build('depot', { metal: 6 })
    .continueBuild(2)
    .deposit()
    .broadcast('forward depot 6,8 live. corridor is ours.')
    .wait(2);

/**
 * Aurora's hauler, running v3 of a script whose route function never learned to
 * read `composition.acid`. It walks east across the flats and is destroyed at the
 * end of round 8, three tiles in. Its last broadcast outlives it.
 */
const doomedHauler = (): AndroidProgram =>
  createAndroidProgram('android-3', { x: 4, y: 5 })
    .walkTo({ x: 7, y: 5 })
    .walkTo({ x: 7, y: 7 })
    .walkTo({ x: 8, y: 7 })
    .broadcast('hull integrity failing. acid at 8,7 is deeper than mapped.')
    .walkTo({ x: 9, y: 7 });

/**
 * Borealis's saboteur. Three hostile salvages finish Aurora's scanner on round 9
 * — worth no readiness points to either side, which is the point: what Aurora
 * loses is sight, and the fog closes over the west approach on the next round
 * end. Then it pockets the scrap and limps home through the shallows.
 */
const reclaimer = (): AndroidProgram =>
  createAndroidProgram('android-4', { x: 9, y: 10 })
    .walkTo({ x: 5, y: 10 })
    .walkTo({ x: 5, y: 8 })
    .salvage(3)
    .broadcast('aurora eye at 5,8 is dark. borealis owns the west approach.')
    .collect()
    .walkTo({ x: 5, y: 9 })
    .walkTo({ x: 11, y: 9 })
    .walkTo({ x: 11, y: 7 });

/**
 * Borealis's terraformer, and the deliberate foil to `doomedHauler`: it clears
 * eight tiles of the flats and only ever steps onto ground it has already
 * cleaned. Same hazard, same board, opposite code.
 */
const terraformer = (): AndroidProgram =>
  createAndroidProgram('android-5', { x: 13, y: 6 })
    .walkTo({ x: 11, y: 6 })
    .walkTo({ x: 11, y: 7 })
    .cleanAcid('west')
    .walkTo({ x: 11, y: 8 })
    .cleanAcid('west')
    .cleanAcid('west')
    .walkTo({ x: 10, y: 8 })
    .cleanAcid('west')
    .cleanAcid('west')
    .cleanAcid('west')
    .walkTo({ x: 9, y: 8 })
    .cleanAcid('north')
    .cleanAcid('north')
    .cleanAcid('north')
    .cleanAcid('west')
    .cleanAcid('west')
    .cleanAcid('west')
    .walkTo({ x: 9, y: 7 })
    .wait();

/** Borealis turning a loose cache into a fourth charger, and so a fourth Android. */
const borealisSupply = (): AndroidProgram =>
  createAndroidProgram('android-6', { x: 12, y: 8 })
    .collect()
    .walkTo({ x: 12, y: 3 })
    .deposit()
    .walkTo({ x: 13, y: 3 })
    .withdraw({ metal: 10 })
    .walkTo({ x: 10, y: 3 })
    .walkTo({ x: 10, y: 4 })
    .build('charger', { metal: 10 })
    .continueBuild(2)
    .walkTo({ x: 10, y: 3 })
    .walkTo({ x: 8, y: 3 })
    .collect();

/** Seat order matters: it is the order Androids act within a round. */
const colonyRacePrograms = (): AndroidProgram[] => [
  colonyCrew(),
  auroraSupply(),
  doomedHauler(),
  reclaimer(),
  terraformer(),
  borealisSupply(),
];

export { colonyRacePrograms };
