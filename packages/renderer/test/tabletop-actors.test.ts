import type { World } from '@morten-olsen/nova-game';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import { animateActors, basePlateRadius, updateActors, type Actor, type PuffRequest } from '../src/tabletop-actors.js';
import { createPieceLayouts } from '../src/tabletop-layout.js';

// Models are fetched over the network, which a headless test has no business
// doing. Actors fall back to their placeholder mesh, which is all this needs.
vi.mock('../src/tabletop-assets.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/tabletop-assets.js')>()),
  loadPieceModel: () => Promise.resolve(undefined),
}));

const createWorld = (active: boolean, position = { x: 0, y: 0 }): World => ({
  tiles: [{ position: { x: 0, y: 0 }, composition: { acid: 0 } }],
  scripts: [],
  buildings: [],
  androids: [
    {
      id: 'android-1',
      ownerId: 'player-1',
      scriptId: 'script-1',
      position,
      battery: 100,
      health: active ? 100 : 0,
      active,
      memory: '',
      recording: '',
    },
  ],
});

type Board = {
  actors: Map<string, Actor>;
  advance: (seconds: number) => void;
  pieces: THREE.Group;
  puffs: PuffRequest[];
  show: (world: World) => void;
};

const createBoard = (): Board => {
  const actors = new Map<string, Actor>();
  const pieces = new THREE.Group();
  const puffs: PuffRequest[] = [];
  const frame = {
    actors,
    delta: 1 / 60,
    elapsed: 0,
    onPuff: (puff: PuffRequest) => puffs.push(puff),
    pieces,
    selectedId: undefined,
  };
  return {
    actors,
    puffs,
    advance: (seconds) => {
      for (let step = 0; step < Math.round(seconds * 60); step += 1) {
        frame.elapsed += frame.delta;
        animateActors(frame);
      }
    },
    pieces,
    show: (world) => updateActors({ actors, pieces, world }),
  };
};

const toppleOf = (actor: Actor | undefined): number => actor?.root.children[0]?.rotation.z ?? 0;

describe('a travelling android', () => {
  /**
   * The lean rotates the model about its origin, which sits at the centre of the
   * base plate on the ground plane, so the leading rim swings below the board
   * unless the lean is paid for with a lift.
   */
  it('leans into travel without dipping its base plate through the board', () => {
    const board = createBoard();
    board.show(createWorld(true));
    board.advance(1);

    // Several tiles at once, so the smoothed travel speed reaches full lean.
    board.show(createWorld(true, { x: 6, y: 0 }));
    board.advance(0.3);

    const visual = board.actors.get('android-1')?.root.children[0];
    expect(visual).toBeDefined();
    // Precondition: it really is leaning, so the assertion below is not vacuous.
    expect(visual!.rotation.x).toBeGreaterThan(0.2);

    // The rim sits `radius * sin(lean)` below the model origin; the gait bob can
    // take a further 0.028 off at its trough. Both have to stay above the board.
    const rimHeight = visual!.position.y - basePlateRadius * Math.sin(visual!.rotation.x);
    expect(rimHeight).toBeGreaterThan(-0.03);
    expect(visual!.position.y).toBeGreaterThan(0);
  });
});

describe('deactivated androids', () => {
  it('take no place on the board', () => {
    expect([...createPieceLayouts(createWorld(true)).keys()]).toEqual(['android-1']);
    expect([...createPieceLayouts(createWorld(false)).keys()]).toEqual([]);
  });

  it('fall over, fade, and are removed from the scene', () => {
    const board = createBoard();
    board.show(createWorld(true));
    board.advance(1);

    expect(toppleOf(board.actors.get('android-1'))).toBeCloseTo(0, 2);

    board.show(createWorld(false));
    board.advance(0.5);

    const actor = board.actors.get('android-1');
    expect(actor?.leaving).toBe(true);
    // Fallen flat, and only fading once it is down.
    expect(toppleOf(actor)).toBeCloseTo(Math.PI / 2, 3);
    expect(actor?.opacity).toBeLessThan(0.9);
    expect(actor?.opacity).toBeGreaterThan(0);

    board.advance(0.5);

    expect(board.actors.has('android-1')).toBe(false);
    expect(board.pieces.children).toEqual([]);
    // Landing puff on arrival, and one more as the wreck goes.
    expect(board.puffs).toHaveLength(2);
  });

  /** A replay can be scrubbed backwards, which is a wreck getting back up. */
  it('stand up again when the world says they are active', () => {
    const board = createBoard();
    board.show(createWorld(true));
    board.advance(1);
    board.show(createWorld(false));
    board.advance(0.2);

    expect(toppleOf(board.actors.get('android-1'))).toBeGreaterThan(1);

    board.show(createWorld(true));
    board.advance(0.5);

    const actor = board.actors.get('android-1');
    expect(actor?.leaving).toBe(false);
    expect(actor?.topple).toBe(0);
    // Eased back upright rather than snapped, so a fraction of a degree remains.
    expect(toppleOf(actor)).toBeLessThan(0.02);
    expect(actor?.opacity).toBeCloseTo(1, 2);
  });
});
