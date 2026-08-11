/**
 * The archetype that tries to build an industry, and the only one that can do the
 * two things the industry tier actually requires.
 *
 * **Multi-trip delivery.** Anything costing more than a cargo hold cannot be
 * bought in one action. A site is placed with whatever is in hand and the rest is
 * hauled to it, which is why a colony module is nine loads rather than
 * unaffordable. The plainer archetypes wait to afford the whole cost, and so
 * never build an extractor at all.
 *
 * **Split loads.** The electronics line needs ore *and* water, and one hold serves
 * both: a hauler that fills up on whichever material the extractor has most of
 * starves the recipe that pays. Measured, that mistake alone was the difference
 * between 0.37 electronics a round and none.
 *
 * Everything it knows about its own colony is in `memory`, because the fog takes
 * a player's own buildings out of view. An earlier version read its build state
 * off `world` and the plan flipped between two buildings on alternate turns as the
 * base went in and out of sight — the android paced between them until it died.
 */

import type { AndroidAction, Building, MaterialBundle, Position, Rules } from '../dist/nova-game.js';

import type { Bot, BotGlobals } from './balance-harness.ts';

type Plan = { name: string; type: Building['type']; want: number; onOre?: boolean };

type Memory = {
  dir?: 'north' | 'south' | 'east' | 'west';
  /** Where each planned building goes, by plan name. */
  slots?: Record<string, Position>;
  /** Where each finished building of ours is, by type. */
  known?: Partial<Record<Building['type'], Position>>;
  /** How many of each type we have started, which the fog cannot take away. */
  built?: Partial<Record<Building['type'], number>>;
  /** The site currently being paid for in installments. */
  site?: { position: Position; type: Building['type']; owed: MaterialBundle };
};

/*
 * Industry before expansion, deliberately. An earlier order put a second charger
 * ahead of the extractor and the extractor never got built: the loose metal ran
 * out first, and a strategy that means to live off the ground has to reach the
 * ground before the ground runs out.
 */
const PLAN: Plan[] = [
  { name: 'depot', type: 'depot', want: 1 },
  { name: 'extractor', type: 'extractor', want: 1, onOre: true },
  { name: 'processor', type: 'processor', want: 1 },
  { name: 'charger-2', type: 'charger', want: 2 },
  { name: 'extractor-2', type: 'extractor', want: 2, onOre: true },
  { name: 'module', type: 'colony-module', want: 1 },
];

const DIRECTIONS = { north: { x: 0, y: -1 }, south: { x: 0, y: 1 }, east: { x: 1, y: 0 }, west: { x: -1, y: 0 } };
const DIRECTION_NAMES = ['north', 'south', 'east', 'west'] as const;

type Direction = (typeof DIRECTION_NAMES)[number];

const key = (position: Position): string => `${position.x},${position.y}`;

const materialsOf = (rules: Rules): (keyof MaterialBundle)[] =>
  Object.keys(rules.scoring.materials) as (keyof MaterialBundle)[];

const totalOf = (rules: Rules, bundle: MaterialBundle | undefined): number =>
  materialsOf(rules).reduce((sum, material) => sum + (bundle?.[material] ?? 0), 0);

/** The tiles around a base, nearest ring first, as candidate building sites. */
const ringAround = (base: Position, rules: Rules): Position[] => {
  const positions: Position[] = [];
  for (let radius = 1; radius <= 3; radius += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) {
          continue;
        }
        const candidate = { x: base.x + dx, y: base.y + dy };
        if (
          candidate.x >= 0 &&
          candidate.y >= 0 &&
          candidate.x < rules.world.width &&
          candidate.y < rules.world.height
        ) {
          positions.push(candidate);
        }
      }
    }
  }
  return positions;
};

/* eslint-disable complexity, max-lines-per-function, max-depth */
const industrialist: Bot = ({ androidId, world, rules }: BotGlobals): AndroidAction => {
  const self = world.androids.find((candidate) => candidate.id === androidId);
  if (!self || !self.active) {
    return { type: 'android.wait' };
  }

  const MATERIALS = materialsOf(rules);
  let memory: Memory = {};
  try {
    memory = JSON.parse(self.memory || '{}') as Memory;
  } catch {
    memory = {};
  }
  memory.dir = memory.dir ?? 'east';
  memory.slots = memory.slots ?? {};
  memory.known = memory.known ?? {};
  // Every player starts with one charger; it is the only thing safe to assume.
  memory.built = memory.built ?? { charger: 1 };
  const act = (action: AndroidAction): AndroidAction => ({ ...action, memory: JSON.stringify(memory) });

  const here = self.position;
  const cargo = self.cargo ?? {};
  const carrying = totalOf(rules, cargo);
  const capacity = rules.android.cargoCapacity;
  const tiles = new Map(world.tiles.map((tile) => [key(tile.position), tile]));
  const mine = (building: Building | undefined): boolean => !!building && building.ownerId === self.ownerId;
  const done = (building: Building | undefined): boolean => !!building && building.remainingConstruction.ticks === 0;
  const buildingAt = (position: Position): Building | undefined =>
    world.buildings.find((building) => key(building.position) === key(position));
  const steps = (from: Position, to: Position): number => Math.abs(from.x - to.x) + Math.abs(from.y - to.y);

  const visible = world.buildings.filter((building) => mine(building));
  for (const building of visible.filter(done)) {
    memory.known[building.type] = building.position;
  }
  const base = memory.known.charger ?? here;
  const countOf = (type: Building['type']): number =>
    Math.max(memory.built[type] ?? 0, visible.filter((building) => building.type === type).length);

  const stepTo = (direction: Direction): Position => ({
    x: here.x + DIRECTIONS[direction].x,
    y: here.y + DIRECTIONS[direction].y,
  });
  const onMap = (direction: Direction): boolean => {
    const next = stepTo(direction);
    return next.x >= 0 && next.y >= 0 && next.x < rules.world.width && next.y < rules.world.height;
  };
  const hazard = (direction: Direction): number => {
    const tile = tiles.get(key(stepTo(direction)));
    return (
      (tile?.composition.acid ?? 0) * rules.android.acidDamagePerPoint +
      (tile?.composition.radiation ?? 0) * rules.android.radiationDamagePerPoint
    );
  };
  const goTo = (target: Position | undefined): AndroidAction | undefined => {
    if (!target || key(here) === key(target)) {
      return undefined;
    }
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
    const direction = options.filter(onMap).sort((left, right) => hazard(left) - hazard(right))[0];
    return direction ? act({ type: 'android.move', direction }) : undefined;
  };

  /** Ours, finished, and able to hold material — the only thing worth walking to. */
  const usable = (building: Building | undefined, type: Building['type']): boolean =>
    !!building && mine(building) && done(building) && building.type === type && !!building.storage;
  const siteHere = buildingAt(here);

  // 1. Finish what is underfoot, but only when it can actually progress: a site
  //    still owed material accepts `continue-construction` and does nothing with
  //    it, which is how a bot burns fifty rounds without one failed turn.
  if (siteHere && mine(siteHere) && siteHere.remainingConstruction.ticks > 0) {
    const owed = siteHere.remainingConstruction.resources;
    const payment: MaterialBundle = {};
    let paying = false;
    for (const material of MATERIALS) {
      const amount = Math.min(owed[material] ?? 0, cargo[material] ?? 0);
      if (amount > 0) {
        payment[material] = amount;
        paying = true;
      }
    }
    if (paying || totalOf(rules, owed) === 0) {
      return act(
        paying
          ? { type: 'android.continue-construction', resources: payment }
          : { type: 'android.continue-construction' },
      );
    }
  }

  // 2. Battery, with enough margin to arrive.
  if (self.battery <= (steps(here, base) + 4) * rules.android.moveBatteryCost) {
    if (key(here) === key(base)) {
      return act({ type: 'android.charge' });
    }
    const move = goTo(base);
    if (move) {
      return move;
    }
  }
  if (key(here) === key(base) && self.battery < rules.android.batteryCapacity * 0.5) {
    return act({ type: 'android.charge' });
  }

  // 3. Spend spare charger capacity.
  const roster = world.androids
    .filter((android) => android.ownerId === self.ownerId && android.active)
    .map((android) => android.id)
    .sort();
  const capacityTotal = visible
    .filter(done)
    .reduce((sum, building) => sum + rules.buildings[building.type].androidCapacity, 0);
  if (key(here) === key(base) && roster.length < Math.min(3, capacityTotal)) {
    return act({ type: 'android.launch', scriptId: self.scriptId });
  }

  const step = PLAN.find((candidate) => countOf(candidate.type) < candidate.want);
  const hasRefinery = !!memory.known.processor && !!memory.known.extractor;
  // With more than one android, half haul feedstock and half build: the same
  // android doing both changes its mind every turn and delivers nothing.
  const myIndex = Math.max(0, roster.indexOf(self.id));
  const haulsFeedstock = hasRefinery && (roster.length < 2 || myIndex % 2 === 0);

  // 4. Keep the refinery fed and bank what it makes.
  if (haulsFeedstock) {
    const feedstock = (cargo.ore ?? 0) + (cargo.water ?? 0);
    const product = (cargo.electronics ?? 0) + (cargo.polymer ?? 0) + (cargo.metal ?? 0);

    if (usable(siteHere, 'extractor') && carrying < capacity) {
      // A split load: the electronics recipe needs both, and one hold serves both.
      const room = capacity - carrying;
      const oreShare = Math.max(1, Math.round(room * 0.6));
      const want: MaterialBundle = {};
      for (const [material, share] of [
        ['ore', oreShare],
        ['water', room - oreShare],
      ] as const) {
        const amount = Math.min(siteHere?.storage?.[material] ?? 0, share);
        if (amount > 0) {
          want[material] = amount;
        }
      }
      if (totalOf(rules, want) > 0) {
        return act({ type: 'android.withdraw', resources: want });
      }
    }
    if (usable(siteHere, 'processor')) {
      if (feedstock > 0) {
        const feed: MaterialBundle = {};
        for (const material of ['ore', 'water'] as const) {
          if ((cargo[material] ?? 0) > 0) {
            feed[material] = cargo[material];
          }
        }
        return act({ type: 'android.deposit', resources: feed });
      }
      const take: MaterialBundle = {};
      let room = capacity - carrying;
      for (const material of ['electronics', 'polymer', 'metal'] as const) {
        const amount = Math.min(siteHere?.storage?.[material] ?? 0, room);
        if (amount > 0) {
          take[material] = amount;
          room -= amount;
        }
      }
      if (totalOf(rules, take) > 0) {
        return act({ type: 'android.withdraw', resources: take });
      }
    }
    if (usable(siteHere, 'depot') && product > 0) {
      return act({ type: 'android.deposit' });
    }

    const destination =
      feedstock > 0 ? memory.known.processor : product > 0 ? memory.known.depot : memory.known.extractor;
    const move = goTo(destination);
    if (move) {
      return move;
    }
  }

  // 5. Deliver to the site being paid for in installments.
  if (
    memory.site &&
    visible.some((building) => key(building.position) === key(memory.site?.position ?? here) && done(building))
  ) {
    memory.site = undefined;
  }
  const openSite = visible.find((building) => building.remainingConstruction.ticks > 0);
  if (openSite) {
    memory.site = {
      position: openSite.position,
      type: openSite.type,
      owed: openSite.remainingConstruction.resources,
    };
  }

  if (memory.site && !(haulsFeedstock && roster.length > 1)) {
    const owed = memory.site.owed;
    const carryingOwed = MATERIALS.some((material) => (owed[material] ?? 0) > 0 && (cargo[material] ?? 0) > 0);
    if (totalOf(rules, owed) === 0 || carryingOwed) {
      const move = goTo(memory.site.position);
      if (move) {
        return move;
      }
    }
    if (usable(siteHere, 'depot')) {
      const take: MaterialBundle = {};
      let room = capacity - carrying;
      for (const material of MATERIALS) {
        const amount = Math.min(owed[material] ?? 0, siteHere?.storage?.[material] ?? 0, room);
        if (amount > 0) {
          take[material] = amount;
          room -= amount;
        }
      }
      if (totalOf(rules, take) > 0) {
        return act({ type: 'android.withdraw', resources: take });
      }
      if (carrying > 0) {
        return act({ type: 'android.deposit' });
      }
    } else if (carrying === 0 || carrying >= capacity) {
      const move = goTo(memory.known.depot);
      if (move) {
        return move;
      }
    }
  }

  // 6. Place the next building on the plan.
  if (step && !memory.site && !(haulsFeedstock && roster.length > 1)) {
    const cost = rules.buildings[step.type].cost;
    const costTotal = totalOf(rules, cost);
    const payable: MaterialBundle = {};
    let payableTotal = 0;
    let short = 0;
    for (const material of MATERIALS) {
      const amount = Math.min(cost[material] ?? 0, cargo[material] ?? 0);
      if (amount > 0) {
        payable[material] = amount;
        payableTotal += amount;
      }
      short += Math.max(0, (cost[material] ?? 0) - (cargo[material] ?? 0));
    }

    let site = memory.slots[step.name];
    if (!site && step.onOre) {
      const oreTile = world.tiles
        .filter((tile) => (tile.composition.ore ?? 0) >= 3 && !buildingAt(tile.position))
        .sort((left, right) => steps(base, left.position) - steps(base, right.position))[0];
      if (oreTile) {
        memory.slots[step.name] = oreTile.position;
        site = oreTile.position;
      }
    }
    if (!site && !step.onOre) {
      const taken = new Set([...Object.values(memory.slots), ...Object.values(memory.known)].map(key));
      const free = ringAround(base, rules).find((position) => !taken.has(key(position)) && !buildingAt(position));
      if (free) {
        memory.slots[step.name] = free;
        site = free;
      }
    }

    // A site is an accumulator: place it as soon as there is something to put in
    // it. Waiting to afford a cost larger than a cargo hold is waiting forever.
    const bigBuild = costTotal > capacity;
    if (site && (short === 0 || (bigBuild && payableTotal > 0))) {
      if (key(here) === key(site)) {
        memory.built[step.type] = countOf(step.type) + 1;
        const owed: MaterialBundle = {};
        for (const material of MATERIALS) {
          const remaining = (cost[material] ?? 0) - (payable[material] ?? 0);
          if (remaining > 0) {
            owed[material] = remaining;
          }
        }
        memory.site = { position: site, type: step.type, owed };
        return act({ type: 'android.start-construction', buildingType: step.type, resources: payable });
      }
      const move = goTo(site);
      if (move) {
        return move;
      }
    }

    if (short > 0 && memory.known.depot) {
      if (usable(siteHere, 'depot')) {
        const take: MaterialBundle = {};
        let room = capacity - carrying;
        let covered = 0;
        for (const material of MATERIALS) {
          const missing = Math.max(0, (cost[material] ?? 0) - (cargo[material] ?? 0));
          const amount = Math.min(missing, siteHere?.storage?.[material] ?? 0, room);
          if (amount > 0) {
            take[material] = amount;
            room -= amount;
            covered += amount;
          }
        }
        if (covered > 0 && (covered === short || bigBuild)) {
          return act({ type: 'android.withdraw', resources: take });
        }
        if (carrying > 0) {
          return act({ type: 'android.deposit' });
        }
      } else if (carrying >= capacity) {
        const move = goTo(memory.known.depot);
        if (move) {
          return move;
        }
      }
    }
  }

  // 7. Gather.
  const standing = tiles.get(key(here));
  if (standing && totalOf(rules, standing.scattered) > 0 && carrying < capacity) {
    return act({ type: 'android.collect' });
  }
  if (carrying >= capacity && memory.known.depot) {
    if (usable(siteHere, 'depot')) {
      return act({ type: 'android.deposit' });
    }
    const move = goTo(memory.known.depot);
    if (move) {
      return move;
    }
  }
  const loose = world.tiles
    .filter((tile) => totalOf(rules, tile.scattered) > 0)
    .sort((left, right) => steps(here, left.position) - steps(here, right.position))[0];
  if (loose && carrying < capacity) {
    const move = goTo(loose.position);
    if (move) {
      return move;
    }
  }

  const preferred = ([memory.dir] as Direction[])
    .concat([...DIRECTION_NAMES])
    .filter(onMap)
    .sort((left, right) => hazard(left) - hazard(right));
  const next = preferred[0];
  if (next) {
    memory.dir = next;
    return act({ type: 'android.move', direction: next });
  }
  return act({ type: 'android.wait' });
};
/* eslint-enable complexity, max-lines-per-function, max-depth */

export type { Memory as IndustrialistMemory };
export { industrialist };
