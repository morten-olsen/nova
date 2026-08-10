import { camera, clearSelection, cut, resetCamera, select, world, type BoardCue } from '../board/board.cues.ts';

/**
 * Act two's shot list.
 *
 * Rounds and camera are scored against each other rather than run at a constant
 * rate: the camera holds a round for several seconds while it tours a base —
 * pieces keep breathing on a held world, because energy pulses, the radar sweep,
 * acid shimmer and dust all advance on `advance` rather than on a new world — and
 * then plays three rounds in four seconds when the acid is eating an Android.
 *
 * The world indices are the beats the generator asserts:
 *
 * | frame | round | beat                                            |
 * | ----: | ----: | ----------------------------------------------- |
 * |     0 |    46 | nothing revealed; two colonies as glints        |
 * |   5-6 | 51-52 | android-3 in the flats, hull 3.7 then 2.1       |
 * |     7 |    53 | its distress broadcast; scanner down to 12      |
 * |     8 |    54 | android-3 destroyed; scanner at 2               |
 * |     9 |    55 | scanner gone, Aurora's sight halves             |
 * | 10-13 | 56-59 | flats being cleaned; module ticking down        |
 * |    14 |    60 | colony module completes — 1,000 points          |
 * |    16 |    62 | forward depot completes                         |
 * |    20 |    66 | final board                                     |
 */

/** Establish: the whole board, dark, then the first round end lighting both camps. */
const establish: BoardCue[] = [
  world(0, 0),
  cut(0, { distance: 16.5 }),
  camera(0.6, { distance: 13.2, duration: 6.4 }),
  world(2.2, 1),
  world(4.6, 2),
];

/**
 * The tour. Holds rounds 3 and 4 and lets the camera do the work, because this is
 * the passage that has to make somebody want the game: the silhouettes, the
 * sweeping radar, the drill, the twin stacks.
 */
const tour: BoardCue[] = [
  world(7.0, 3),
  // Borealis: relay mast, radar slab, acid plant.
  camera(7.2, { distance: 6.4, duration: 2.8, position: { x: 13.4, y: 2.6 } }),
  select(8.4, { pieceId: 'borealis-radar', position: { x: 12, y: 5 } }),
  camera(10.4, { distance: 5.8, duration: 2.6, position: { x: 12.6, y: 4.4 } }),
  clearSelection(12.6),
  world(12.0, 4),
  // Across to Aurora: chargers, extractor, processor.
  camera(13.2, { distance: 7.6, duration: 2.9, position: { x: 3, y: 9.4 } }),
  select(14.6, { pieceId: 'aurora-extractor', position: { x: 4, y: 10 } }),
  camera(16.4, { distance: 5.9, duration: 2.5, position: { x: 3.6, y: 9.8 } }),
  clearSelection(18.4),
];

/** The hazard. Down into the flats, and the rounds start moving again. */
const hazard: BoardCue[] = [
  camera(19.0, { distance: 7.2, duration: 2.6, position: { x: 8, y: 7 } }),
  world(19.4, 5),
  select(20.2, { pieceId: 'android-3', position: { x: 7, y: 7 } }),
  world(21.6, 6),
  // The reticle has to follow: it marks a tile, not a piece, so it stays where it
  // was put while the Android it is pointing at walks a tile deeper into the acid.
  select(21.8, { pieceId: 'android-3', position: { x: 8, y: 7 } }),
  camera(22.4, { distance: 5.4, duration: 2.2, position: { x: 8.4, y: 7 } }),
  world(23.6, 7),
  // Round 54: the hull runs out and the piece sinks out of the board.
  world(26.0, 8),
  clearSelection(27.4),
];

/** The sabotage. West to Aurora's scanner, and the fog closing over the gap. */
const sabotage: BoardCue[] = [
  camera(28.2, { distance: 6.6, duration: 2.4, position: { x: 5, y: 8.4 } }),
  select(29.0, { pieceId: 'aurora-scanner', position: { x: 5, y: 8 } }),
  // Round 55: the scanner is destroyed and Aurora's revealed ground halves.
  world(30.4, 9),
  clearSelection(31.4),
  camera(31.6, { distance: 11.5, duration: 3, position: { x: 6.5, y: 7.5 } }),
];

/** Recovery: the flats being cleaned, the module counting down. */
const buildUp: BoardCue[] = [
  world(34.0, 10),
  camera(34.4, { distance: 7.8, duration: 2.8, position: { x: 9.4, y: 7.8 } }),
  world(36.0, 11),
  select(36.4, { pieceId: 'android-5', position: { x: 10, y: 8 } }),
  world(38.0, 12),
  clearSelection(39.0),
  camera(39.2, { distance: 8.4, duration: 2.6, position: { x: 6, y: 6.4 } }),
  world(40.0, 13),
];

/**
 * The climax: round 60, and the hero piece finishes.
 *
 * Round 62 is where the camera goes closest, not round 60. The module completes at
 * 60 with its crew still standing on the tile — which is the moment the score
 * moves — and the crew steps clear at 62, which is the moment the piece can be
 * seen. Splitting the two gives the beat a completion and then a reveal.
 */
const climax: BoardCue[] = [
  camera(41.6, { distance: 5.6, duration: 2.2, position: { x: 6, y: 6 } }),
  select(42.2, { position: { x: 6, y: 6 } }),
  world(43.2, 14),
  select(43.4, { pieceId: 'aurora-colony-module', position: { x: 6, y: 6 } }),
  world(45.2, 15),
  world(46.4, 16),
  camera(46.6, { distance: 4.6, duration: 2, position: { x: 6, y: 6.1 } }),
  clearSelection(48.4),
];

/** Out to the whole board for the title, playing the last rounds under it. */
const outro: BoardCue[] = [resetCamera(48.8, 5.5), world(50.4, 17), world(52.4, 18), world(54.4, 19), world(56.4, 20)];

const actTwoCues: BoardCue[] = [...establish, ...tour, ...hazard, ...sabotage, ...buildUp, ...climax, ...outro];

export { actTwoCues };
