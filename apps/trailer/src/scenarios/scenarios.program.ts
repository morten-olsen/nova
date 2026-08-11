import type {
  AndroidAction,
  AndroidEvent,
  BuildingType,
  Direction,
  Event,
  MaterialBundle,
  Position,
  World,
} from '@morten-olsen/nova-game';

/**
 * A single round's worth of intent for one Android. `undefined` means the Android
 * did not act that round, which is what a real script returning nothing looks
 * like from the outside.
 */
type Turn = AndroidEvent | undefined;

/**
 * Author-side view of one Android's run.
 *
 * The real game gives a script exactly one action per round, so a choreographed
 * recording has to be written the same way or it stops being a recording of this
 * game. Each call appends one round; `composeRounds` then transposes the
 * per-Android columns into the round-by-round event stream the ruleset replays.
 *
 * The builder tracks the Android's position as it goes, so routes are written as
 * destinations (`walkTo`) rather than as strings of compass directions that are
 * impossible to check by eye.
 */
type AndroidProgram = {
  build: (buildingType: BuildingType, resources?: MaterialBundle) => AndroidProgram;
  broadcast: (content: string) => AndroidProgram;
  charge: () => AndroidProgram;
  cleanAcid: (direction: Direction) => AndroidProgram;
  collect: (resources?: MaterialBundle) => AndroidProgram;
  continueBuild: (times?: number) => AndroidProgram;
  deposit: (resources?: MaterialBundle) => AndroidProgram;
  readonly id: string;
  /** Where the Android stands after every turn queued so far. */
  readonly position: Position;
  salvage: (times?: number) => AndroidProgram;
  /** Rounds recorded so far, so scenes can be timed against the world. */
  readonly turnCount: number;
  turns: () => Turn[];
  wait: (times?: number) => AndroidProgram;
  /** One orthogonal step per round, x first and then y. */
  walkTo: (target: Position) => AndroidProgram;
  withdraw: (resources: MaterialBundle) => AndroidProgram;
};

const stepDirection = (from: Position, to: Position): Direction => {
  if (to.x > from.x) {
    return 'east';
  }
  if (to.x < from.x) {
    return 'west';
  }
  return to.y > from.y ? 'south' : 'north';
};

/** Orthogonal steps from `from` to `to`, x axis first. */
const stepsBetween = (from: Position, to: Position): Position[] => {
  const steps: Position[] = [];
  const at = { ...from };
  while (at.x !== to.x) {
    at.x += to.x > at.x ? 1 : -1;
    steps.push({ ...at });
  }
  while (at.y !== to.y) {
    at.y += to.y > at.y ? 1 : -1;
    steps.push({ ...at });
  }
  return steps;
};

const createAndroidProgram = (id: string, start: Position): AndroidProgram => {
  const turns: Turn[] = [];
  let at = { ...start };

  const push = (event: AndroidAction): AndroidProgram => {
    turns.push({ ...event, androidId: id } as AndroidEvent);
    return program;
  };

  const repeat = (times: number, event: AndroidAction): AndroidProgram => {
    for (let index = 0; index < times; index += 1) {
      push(event);
    }
    return program;
  };

  const program: AndroidProgram = {
    build: (buildingType, resources) => push({ type: 'android.start-construction', buildingType, resources }),
    broadcast: (content) => push({ type: 'android.broadcast', content }),
    charge: () => push({ type: 'android.charge' }),
    cleanAcid: (direction) => push({ type: 'android.clean-acid', direction }),
    collect: (resources) => push({ type: 'android.collect', resources }),
    continueBuild: (times = 1) => repeat(times, { type: 'android.continue-construction' }),
    deposit: (resources) => push({ type: 'android.deposit', resources }),
    id,
    get position() {
      return { ...at };
    },
    salvage: (times = 1) => repeat(times, { type: 'android.salvage' }),
    get turnCount() {
      return turns.length;
    },
    turns: () => [...turns],
    wait: (times = 1) => repeat(times, { type: 'android.wait' }),
    walkTo: (target) => {
      for (const step of stepsBetween(at, target)) {
        push({ type: 'android.move', direction: stepDirection(at, step) });
        at = step;
      }
      return program;
    },
    withdraw: (resources) => push({ type: 'android.withdraw', resources }),
  };

  return program;
};

/**
 * Transposes per-Android programs into the round-by-round event stream a
 * recording holds: `game.round-start`, each acting Android's single action in
 * seat order, then `game.round-end`.
 */
const composeRounds = (programs: AndroidProgram[]): Event[] => {
  const columns = programs.map((program) => program.turns());
  const rounds = Math.max(0, ...columns.map((column) => column.length));
  const events: Event[] = [];

  for (let round = 0; round < rounds; round += 1) {
    events.push({ type: 'game.round-start' });
    for (const column of columns) {
      const turn = column[round];
      if (turn) {
        events.push(turn);
      }
    }
    events.push({ type: 'game.round-end' });
  }

  return events;
};

type Recording = {
  events: Event[];
  initialWorld: World;
  version: 1;
};

export type { AndroidProgram, Recording, Turn };
export { composeRounds, createAndroidProgram, stepsBetween };
