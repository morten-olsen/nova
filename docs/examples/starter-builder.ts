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
 * Two rules worth internalising before editing this:
 *
 *   - Only material inside a completed building scores. Loose material and
 *     cargo are worth nothing, so this bot banks what it digs.
 *   - `tile.scattered` is loose material you can collect. `tile.composition` is
 *     what is in the ground — ore, water, acid, radiation — and it can never be
 *     collected directly. It needs an extractor.
 *
 * An android is a module that default-exports its turn function. That function
 * is called once per round and returns that round's action, so every decision
 * below is a `return`. Splitting part of it into `bot/lib/` and importing that
 * back needs no other change: the CLI follows the imports and bundles them in.
 *
 * The types — `AndroidTurn`, `Action`, `Tile`, and the `world` and `androidId`
 * globals — come with the game; nothing here imports them. The CLI compiles this
 * file before uploading it, so a mistyped action is a compiler error rather than
 * a lost turn. Run `npm run check` to see them all at once.
 */
type Memory = {
  dir?: Direction;
  charger?: Position;
  depot?: Position;
};

const takeTurn: AndroidTurn = () => {
  const self = world.androids.find((a) => a.id === androidId);
  if (!self || !self.active) {
    return { type: 'android.wait' } satisfies Action;
  }

  const CARGO_CAP = 10;
  const DEPOT_COST = 6;
  const CHARGER_COST = 10;

  const key = (p: Position): string => p.x + ',' + p.y;
  const here = self.position;
  const tiles = new Map(world.tiles.map((t) => [key(t.position), t]));
  const tileAt = (p: Position): Tile | undefined => tiles.get(key(p));
  const mine = (b: Building | undefined): boolean => !!b && b.ownerId === self.ownerId;
  const buildingAt = (p: Position): Building | undefined => world.buildings.find((b) => key(b.position) === key(p));
  const complete = (b: Building | undefined): boolean => !!b && b.remainingConstruction.ticks === 0;
  const steps = (a: Position, b: Position): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

  const MATERIALS = ['metal', 'electronics', 'polymer', 'ore', 'water', 'acidCanister'] as const;
  const total = (bundle: MaterialBundle | undefined): number =>
    MATERIALS.reduce((sum, k) => sum + (bundle?.[k] ?? 0), 0);
  const cargo = self.cargo ?? {};
  const carrying = total(cargo);
  const metal = cargo.metal ?? 0;

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

  // Re-pin landmarks whenever they are actually in view.
  const seenCharger = world.buildings.find((b) => mine(b) && b.type === 'charger' && complete(b));
  const seenDepot = world.buildings.find((b) => mine(b) && b.type === 'depot' && complete(b));
  if (seenCharger) {
    mem.charger = seenCharger.position;
  }
  if (seenDepot) {
    mem.depot = seenDepot.position;
  }

  const log = (line: string): string => {
    const previous = (self.recording || '').split('\n').filter(Boolean);
    // Bounded: recording is capped at 16k, and the last 40 rounds are the
    // interesting ones when working out why a bot stalled.
    return previous
      .concat('r' + (world.round ?? 0) + ' ' + line)
      .slice(-40)
      .join('\n');
  };
  const act = (action: Action, note: string): Action => ({
    ...action,
    memory: JSON.stringify(mem),
    recording: log(note),
  });

  /*
   * The most important safety rule: moving off the map fails the turn and
   * deactivates the android permanently.
   *
   * The map bounds are not readable — the world is fogged. But an android
   * reveals everything within 2 steps of itself, so a neighbouring tile that is
   * still missing from `world.tiles` cannot exist. Absent neighbour means edge.
   */
  const DIRS: Record<Direction, Position> = {
    north: { x: 0, y: -1 },
    south: { x: 0, y: 1 },
    east: { x: 1, y: 0 },
    west: { x: -1, y: 0 },
  };
  const stepTo = (dir: Direction): Position => ({ x: here.x + DIRS[dir].x, y: here.y + DIRS[dir].y });
  const onMap = (dir: Direction): boolean => Boolean(tileAt(stepTo(dir)));
  // Acid costs 0.5 health per point per round and radiation 0.25, so acid is
  // weighted double when choosing between two otherwise equal steps.
  const hazard = (dir: Direction): number => {
    const t = tileAt(stepTo(dir));
    return t ? (t.composition.acid ?? 0) * 2 + (t.composition.radiation ?? 0) : 0;
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

  // 2. Battery. Moving costs 1 and a charge gives 25, so head back with enough
  //    margin to arrive: an android that reaches 0 battery is destroyed.
  const charger = mem.charger;
  if (charger && self.battery <= steps(here, charger) + 8) {
    if (key(here) === key(charger)) {
      return act({ type: 'android.charge' }, 'charging at ' + self.battery);
    }
    const dir = towards(charger);
    if (dir) {
      return move(dir, 'returning to charge at ' + self.battery);
    }
  }
  if (charger && key(here) === key(charger) && self.battery < 60) {
    return act({ type: 'android.charge' }, 'topping up at ' + self.battery);
  }

  // 3. Bank cargo. Stored material is the only material that scores.
  if (mine(siteHere) && complete(siteHere) && siteHere?.type === 'depot' && carrying > 0) {
    return act({ type: 'android.deposit' }, 'deposited ' + carrying);
  }

  // 4. Collect what we are standing on.
  const standingOn = tileAt(here);
  if (standingOn && total(standingOn.scattered) > 0 && carrying < CARGO_CAP) {
    return act({ type: 'android.collect' }, 'collecting');
  }

  // 5. Build. A depot first — cheapest points on the board, and it turns every
  //    later haul into score. Then chargers, which raise the android cap.
  const freeHere = !siteHere;
  if (freeHere && !mem.depot && metal >= DEPOT_COST) {
    return act(
      { type: 'android.start-construction', buildingType: 'depot', resources: { metal: DEPOT_COST } },
      'starting depot',
    );
  }
  if (freeHere && mem.depot && metal >= CHARGER_COST) {
    return act(
      { type: 'android.start-construction', buildingType: 'charger', resources: { metal: CHARGER_COST } },
      'starting charger',
    );
  }

  // 6. Full hands and somewhere to put them.
  if (carrying >= CARGO_CAP && mem.depot) {
    const dir = towards(mem.depot);
    if (dir) {
      return move(dir, 'hauling ' + carrying + ' to depot');
    }
  }

  // 7. Head for the nearest material in sight.
  const loose = world.tiles
    .filter((t) => total(t.scattered) > 0)
    .sort((a, b) => steps(here, a.position) - steps(here, b.position))[0];
  if (loose && carrying < CARGO_CAP) {
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
