/* eslint-disable complexity, max-lines-per-function */
/*
 * Starter android.
 *
 * Priorities, highest first:
 *   1. finish what it started         5. build a depot, then chargers
 *   2. keep its battery alive         6. haul a full load back to the depot
 *   3. bank cargo into a depot        7. walk toward the nearest material
 *   4. collect what it is standing on 8. explore, turning at the map edge
 *
 * Three rules worth internalising before editing this:
 *
 *   - Only material inside a completed building scores. Loose material and
 *     cargo are worth nothing, so this bot banks what it digs.
 *   - `tile.scattered` is loose material you can collect. `tile.composition` is
 *     what is in the ground — ore, water, acid, radiation — and it can never be
 *     collected directly. It needs an extractor.
 *   - Not one number below is written down twice. Cargo capacity, build costs,
 *     the board's size, what a charge is worth and what a hazard costs all come
 *     from the `rules` global, so this bot plays the game it was handed rather
 *     than the game it was written against. Copy a number out of the rulebook
 *     into a bot and you have written a bot that breaks when the game is tuned.
 *
 * An android is a module that default-exports its turn function. That function
 * is called once per round and returns that round's action, so every decision
 * below is a `return`. Splitting part of it into `bot/lib/` and importing that
 * back needs no other change: the CLI follows the imports and bundles them in.
 *
 * The types — `AndroidTurn`, `Action`, `Tile`, and the `world`, `androidId` and
 * `rules` globals — come with the game; nothing here imports them. The CLI
 * compiles this file before uploading it, so a mistyped action is a compiler
 * error rather than a lost turn. Run `npm run check` to see them all at once.
 */
type Memory = {
  dir?: Direction;
  charger?: Position;
  depot?: Position;
};

/** Steps of battery kept in hand on top of the trip home. A policy, not a rule. */
const SAFETY_STEPS = 8;
/** Top up when a charger is underfoot and the battery is below this share of full. */
const TOP_UP_AT = 0.6;
/** Rounds of log kept: the last few are the ones that explain a stall. */
const LOG_LINES = 40;

const takeTurn: AndroidTurn = () => {
  const self = world.androids.find((a) => a.id === androidId);
  if (!self || !self.active) {
    return { type: 'android.wait' } satisfies Action;
  }

  const key = (p: Position): string => p.x + ',' + p.y;
  const here = self.position;
  const tiles = new Map(world.tiles.map((t) => [key(t.position), t]));
  const tileAt = (p: Position): Tile | undefined => tiles.get(key(p));
  const mine = (b: Building | undefined): boolean => !!b && b.ownerId === self.ownerId;
  const buildingAt = (p: Position): Building | undefined => world.buildings.find((b) => key(b.position) === key(p));
  const complete = (b: Building | undefined): boolean => !!b && b.remainingConstruction.ticks === 0;
  const steps = (a: Position, b: Position): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

  // The materials the game currently has, taken from the scoring table rather
  // than listed here, so a new material is counted the day it is added.
  const MATERIALS = Object.keys(rules.scoring.materials) as (keyof MaterialBundle)[];
  const total = (bundle: MaterialBundle | undefined): number =>
    MATERIALS.reduce((sum, k) => sum + (bundle?.[k] ?? 0), 0);
  const cargo = self.cargo ?? {};
  const carrying = total(cargo);
  const capacity = rules.android.cargoCapacity;
  const affordable = (cost: MaterialBundle): boolean => MATERIALS.every((k) => (cargo[k] ?? 0) >= (cost[k] ?? 0));
  const depotCost = rules.buildings.depot.cost;
  const chargerCost = rules.buildings.charger.cost;

  /*
   * Remembering is not optional. Visibility is recomputed every round, so a tile
   * drops out of `world` as soon as nothing of ours is near it — the depot built
   * five turns ago is simply gone from view. Anything we need to walk back to
   * has to be written down in `memory`.
   */
  let mem: Memory = {};
  try {
    mem = JSON.parse(self.memory || '{}') as Memory;
  } catch {
    mem = {};
  }
  mem.dir = mem.dir ?? 'east';

  // Re-pin landmarks whenever they are actually in view. A charger is whatever
  // building can actually charge us, which is a rule rather than a type name.
  const charges = (b: Building): boolean => rules.buildings[b.type].charge > 0;
  const stores = (b: Building): boolean => rules.buildings[b.type].storage?.deposit === true;
  const seenCharger = world.buildings.find((b) => mine(b) && charges(b) && complete(b));
  const seenDepot = world.buildings.find((b) => mine(b) && stores(b) && complete(b));
  if (seenCharger) {
    mem.charger = seenCharger.position;
  }
  if (seenDepot) {
    mem.depot = seenDepot.position;
  }

  const log = (line: string): string => {
    const previous = (self.recording || '').split('\n').filter(Boolean);
    // Bounded: the recording is capped at `rules.android.recordingLimit`, and the
    // last few rounds are the interesting ones when working out why a bot stalled.
    return previous
      .concat('r' + (world.round ?? 0) + ' ' + line)
      .slice(-LOG_LINES)
      .join('\n');
  };
  const act = (action: Action, note: string): Action => ({
    ...action,
    memory: JSON.stringify(mem),
    recording: log(note),
  });

  /*
   * The most important safety rule: moving off the map fails the turn, which
   * costs the round and `rules.android.failedTurnHealthPenalty` health.
   *
   * The board's size is in the rules, so the edge can simply be computed. The
   * fog hides what is *on* a tile, never how big the planet is.
   */
  const DIRS: Record<Direction, Position> = {
    north: { x: 0, y: -1 },
    south: { x: 0, y: 1 },
    east: { x: 1, y: 0 },
    west: { x: -1, y: 0 },
  };
  const stepTo = (dir: Direction): Position => ({ x: here.x + DIRS[dir].x, y: here.y + DIRS[dir].y });
  const onMap = (dir: Direction): boolean => {
    const p = stepTo(dir);
    return p.x >= 0 && p.y >= 0 && p.x < rules.world.width && p.y < rules.world.height;
  };
  // Hazards are weighted by what they actually cost this android per round, so
  // a ruleset where radiation bites harder than acid reverses the preference.
  const hazard = (dir: Direction): number => {
    const t = tileAt(stepTo(dir));
    if (!t) {
      return 0;
    }
    return (
      (t.composition.acid ?? 0) * rules.android.acidDamagePerPoint +
      (t.composition.radiation ?? 0) * rules.android.radiationDamagePerPoint
    );
  };

  const towards = (target: Position): Direction | undefined => {
    const options: Direction[] = [];
    if (target.x > here.x) {
      options.push('east');
    }
    if (target.x < here.x) {
      options.push('west');
    }
    if (target.y > here.y) {
      options.push('south');
    }
    if (target.y < here.y) {
      options.push('north');
    }
    return options.filter(onMap).sort((a, b) => hazard(a) - hazard(b))[0];
  };

  const move = (dir: Direction, note: string): Action => act({ type: 'android.move', direction: dir }, note);

  // 1. Finish what we started. A half-built depot scores nothing.
  const siteHere = buildingAt(here);
  if (siteHere && mine(siteHere) && siteHere.remainingConstruction.ticks > 0) {
    return act({ type: 'android.continue-construction' }, 'building ' + siteHere.type);
  }

  // 2. Battery. Head back with enough margin to arrive: an android that reaches
  //    0 battery is destroyed, and every step costs `moveBatteryCost`.
  const charger = mem.charger;
  const homeCost = (target: Position): number => (steps(here, target) + SAFETY_STEPS) * rules.android.moveBatteryCost;
  if (charger && self.battery <= homeCost(charger)) {
    if (key(here) === key(charger)) {
      return act({ type: 'android.charge' }, 'charging at ' + self.battery);
    }
    const dir = towards(charger);
    if (dir) {
      return move(dir, 'returning to charge at ' + self.battery);
    }
  }
  if (charger && key(here) === key(charger) && self.battery < rules.android.batteryCapacity * TOP_UP_AT) {
    return act({ type: 'android.charge' }, 'topping up at ' + self.battery);
  }

  // 3. Bank cargo. Stored material is the only material that scores.
  if (siteHere && mine(siteHere) && complete(siteHere) && stores(siteHere) && carrying > 0) {
    return act({ type: 'android.deposit' }, 'deposited ' + carrying);
  }

  // 4. Collect what we are standing on.
  const standingOn = tileAt(here);
  if (standingOn && total(standingOn.scattered) > 0 && carrying < capacity) {
    return act({ type: 'android.collect' }, 'collecting');
  }

  // 5. Build. A depot first — cheapest points on the board, and it turns every
  //    later haul into score. Then chargers, which raise the android cap.
  const freeHere = !siteHere;
  if (freeHere && !mem.depot && affordable(depotCost)) {
    return act({ type: 'android.start-construction', buildingType: 'depot', resources: depotCost }, 'starting depot');
  }
  if (freeHere && mem.depot && affordable(chargerCost)) {
    return act(
      { type: 'android.start-construction', buildingType: 'charger', resources: chargerCost },
      'starting charger',
    );
  }

  // 6. Full hands and somewhere to put them.
  if (carrying >= capacity && mem.depot) {
    const dir = towards(mem.depot);
    if (dir) {
      return move(dir, 'hauling ' + carrying + ' to depot');
    }
  }

  // 7. Head for the nearest material in sight.
  const loose = world.tiles
    .filter((t) => total(t.scattered) > 0)
    .sort((a, b) => steps(here, a.position) - steps(here, b.position))[0];
  if (loose && carrying < capacity) {
    const dir = towards(loose.position);
    if (dir) {
      return move(dir, 'heading to material at ' + key(loose.position));
    }
  }

  // 8. Nothing in sight. Explore, turning at the edge instead of walking into it.
  const preferred = ([mem.dir] as Direction[])
    .concat(['east', 'south', 'west', 'north'])
    .filter(onMap)
    .sort((a, b) => hazard(a) - hazard(b));
  const next = preferred[0];
  if (next) {
    mem.dir = next;
    return move(next, 'exploring ' + next);
  }

  // Boxed in. Waiting beats failing a turn.
  return act({ type: 'android.wait' }, 'no safe move');
};

export default takeTurn;
