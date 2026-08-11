/**
 * Strategy archetypes, sharing one body so that the difference between two lines
 * on the scoreboard is a difference in strategy rather than in coding quality.
 *
 * They exist to answer one question: is there a single right answer? A tuning
 * pass that leaves one archetype winning every match has not finished.
 *
 * None of them is a good Android. They are deliberately plain — no pathfinding,
 * no cooperation, no endgame — because a balance harness measures the rules, and
 * a clever bot hides the rules behind its own cleverness.
 */

import type { AndroidAction, Building, MaterialBundle, Position, Rules } from '../dist/nova-game.js';

import { industrialist } from './balance-industrialist.ts';
import type { Bot, BotGlobals } from './balance-harness.ts';

type Strategy = {
  /** Bank cargo into storage rather than spending it where it stands. */
  deposit: boolean;
  /** Launch siblings when charger capacity allows. */
  fleet: boolean;
  /** What to build, in order of preference, and how many of each. */
  buildOrder: { type: Building['type']; limit?: number; needsOre?: boolean }[];
};

type Memory = {
  dir?: 'north' | 'south' | 'east' | 'west';
  charger?: Position;
  depot?: Position;
  built?: Partial<Record<Building['type'], number>>;
};

const DIRECTIONS: Record<string, Position> = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
};
const DIRECTION_NAMES = ['north', 'south', 'east', 'west'] as const;

type Direction = (typeof DIRECTION_NAMES)[number];

const materialsOf = (rules: Rules): (keyof MaterialBundle)[] =>
  Object.keys(rules.scoring.materials) as (keyof MaterialBundle)[];

const totalOf = (rules: Rules, bundle: MaterialBundle | undefined): number =>
  materialsOf(rules).reduce((sum, key) => sum + (bundle?.[key] ?? 0), 0);

const positionKey = (position: Position): string => `${position.x},${position.y}`;

const readMemory = (raw: string): Memory => {
  try {
    return JSON.parse(raw || '{}') as Memory;
  } catch {
    return {};
  }
};

/* eslint-disable complexity, max-lines-per-function */
const makeBot =
  (strategy: Strategy): Bot =>
  ({ androidId, world, rules }: BotGlobals): AndroidAction => {
    const self = world.androids.find((candidate) => candidate.id === androidId);
    if (!self || !self.active) {
      return { type: 'android.wait' };
    }

    const memory = readMemory(self.memory ?? '');
    memory.dir = memory.dir ?? 'east';
    memory.built = memory.built ?? {};
    const act = (action: AndroidAction): AndroidAction => ({ ...action, memory: JSON.stringify(memory) });

    const here = self.position;
    const cargo = self.cargo ?? {};
    const carrying = totalOf(rules, cargo);
    const capacity = rules.android.cargoCapacity;
    const tiles = new Map(world.tiles.map((tile) => [positionKey(tile.position), tile]));
    const mine = (building: Building | undefined): boolean => !!building && building.ownerId === self.ownerId;
    const complete = (building: Building | undefined): boolean =>
      !!building && building.remainingConstruction.ticks === 0;
    const buildingAt = (position: Position): Building | undefined =>
      world.buildings.find((building) => positionKey(building.position) === positionKey(position));
    const steps = (from: Position, to: Position): number => Math.abs(from.x - to.x) + Math.abs(from.y - to.y);

    const stepTo = (direction: Direction): Position => ({
      x: here.x + (DIRECTIONS[direction]?.x ?? 0),
      y: here.y + (DIRECTIONS[direction]?.y ?? 0),
    });
    const onMap = (direction: Direction): boolean => {
      const next = stepTo(direction);
      return next.x >= 0 && next.y >= 0 && next.x < rules.world.width && next.y < rules.world.height;
    };
    const hazard = (direction: Direction): number => {
      const tile = tiles.get(positionKey(stepTo(direction)));
      return (
        (tile?.composition.acid ?? 0) * rules.android.acidDamagePerPoint +
        (tile?.composition.radiation ?? 0) * rules.android.radiationDamagePerPoint
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
      return options.filter(onMap).sort((left, right) => hazard(left) - hazard(right))[0];
    };

    const charges = (building: Building): boolean => rules.buildings[building.type].charge > 0;
    const stores = (building: Building): boolean => rules.buildings[building.type].storage?.deposit === true;
    const seenCharger = world.buildings.find((b) => mine(b) && charges(b) && complete(b));
    const seenDepot = world.buildings.find((b) => mine(b) && stores(b) && complete(b));
    if (seenCharger) {
      memory.charger = seenCharger.position;
    }
    if (seenDepot) {
      memory.depot = seenDepot.position;
    }

    // 1. Finish what is underfoot, paying whatever of the bill is in cargo.
    const siteHere = buildingAt(here);
    if (siteHere && mine(siteHere) && siteHere.remainingConstruction.ticks > 0) {
      const owed = siteHere.remainingConstruction.resources;
      const payment: MaterialBundle = {};
      let paying = false;
      for (const key of materialsOf(rules)) {
        const amount = Math.min(owed[key] ?? 0, cargo[key] ?? 0);
        if (amount > 0) {
          payment[key] = amount;
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
    const charger = memory.charger;
    if (charger) {
      const homeCost = (steps(here, charger) + 6) * rules.android.moveBatteryCost;
      if (self.battery <= homeCost) {
        if (positionKey(here) === positionKey(charger)) {
          return act({ type: 'android.charge' });
        }
        const direction = towards(charger);
        if (direction) {
          return act({ type: 'android.move', direction });
        }
      }
      if (positionKey(here) === positionKey(charger) && self.battery < rules.android.batteryCapacity * 0.6) {
        return act({ type: 'android.charge' });
      }
    }

    // 3. Spend spare charger capacity on another android.
    if (strategy.fleet && charger && positionKey(here) === positionKey(charger)) {
      const capacityTotal = world.buildings
        .filter((b) => mine(b) && complete(b))
        .reduce((sum, b) => sum + rules.buildings[b.type].androidCapacity, 0);
      const active = world.androids.filter((a) => a.ownerId === self.ownerId && a.active).length;
      if (active < capacityTotal) {
        return act({ type: 'android.launch', scriptId: self.scriptId });
      }
    }

    // 4. Bank, if this strategy banks.
    if (strategy.deposit && siteHere && mine(siteHere) && complete(siteHere) && stores(siteHere) && carrying > 0) {
      return act({ type: 'android.deposit' });
    }

    // 5. Collect what is underfoot.
    const standing = tiles.get(positionKey(here));
    if (standing && totalOf(rules, standing.scattered) > 0 && carrying < capacity) {
      return act({ type: 'android.collect' });
    }

    // 6. Build, in the strategy's order.
    if (!siteHere) {
      for (const wanted of strategy.buildOrder) {
        const already = memory.built[wanted.type] ?? 0;
        if (already >= (wanted.limit ?? Number.POSITIVE_INFINITY)) {
          continue;
        }
        const cost = rules.buildings[wanted.type].cost;
        if (!materialsOf(rules).every((key) => (cargo[key] ?? 0) >= (cost[key] ?? 0))) {
          continue;
        }
        if (wanted.needsOre && (standing?.composition.ore ?? 0) < 2) {
          continue;
        }
        memory.built[wanted.type] = already + 1;
        return act({ type: 'android.start-construction', buildingType: wanted.type, resources: cost });
      }
    }

    // 7. Walk to the nearest loose material in sight.
    const loose = world.tiles
      .filter((tile) => totalOf(rules, tile.scattered) > 0)
      .sort((left, right) => steps(here, left.position) - steps(here, right.position))[0];
    if (loose && carrying < capacity && positionKey(loose.position) !== positionKey(here)) {
      const direction = towards(loose.position);
      if (direction) {
        return act({ type: 'android.move', direction });
      }
    }

    // 8. Full hands, somewhere to put them.
    if (carrying >= capacity && strategy.deposit && memory.depot) {
      const direction = towards(memory.depot);
      if (direction) {
        return act({ type: 'android.move', direction });
      }
    }

    // 9. Explore, turning at the edge and away from hazards.
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
/* eslint-enable complexity, max-lines-per-function */

/** The field the acceptance test plays. */
const archetypes: Record<string, Bot> = {
  /** Cheapest points on the board, over and over. */
  sprawler: makeBot({ deposit: false, fleet: false, buildOrder: [{ type: 'depot' }] }),
  /** Bank everything into one depot and score the stockpile. */
  hoarder: makeBot({ deposit: true, fleet: false, buildOrder: [{ type: 'depot', limit: 1 }] }),
  /** A depot, then chargers and the androids they allow, then more depots. */
  expander: makeBot({
    deposit: true,
    fleet: true,
    buildOrder: [{ type: 'depot', limit: 1 }, { type: 'charger', limit: 3 }, { type: 'depot' }],
  }),
  /** Aims at the production tier, and at the module behind it. */
  industrialist,
};

export type { Strategy };
export { archetypes, makeBot };
