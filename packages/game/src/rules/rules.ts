import { z } from 'zod';

import type { World } from '../schemas/schemas.world.js';
import { getWorldSize } from '../utils/utils.world.js';

import { androidRulesSchema } from './rules.android.js';
import { buildingsRulesSchema, salvageRulesSchema } from './rules.buildings.js';
import { scoringRulesSchema } from './rules.scoring.js';
import { worldRulesSchema } from './rules.world.js';

const matchRulesSchema = z.object({
  /**
   * The round the match is scheduled to end on, written into the world at setup
   * so scripts can read it as the `finalTurn` global. `null` means the match
   * runs until its host stops it.
   */
  finalRound: z.int().min(1).nullable().default(null),
});

type MatchRules = z.infer<typeof matchRulesSchema>;

/**
 * Every number the game is played with, in one place.
 *
 * Two audiences, and they are the reason this is a schema rather than a pile of
 * constants. A designer supplies as little or as much as they want to change —
 * `{}` is the shipped game, `{ android: { cargoCapacity: 4 } }` is the shipped
 * game with smaller hands — and a script *reads* the resolved result, so an
 * Android can be written against the rules it is actually playing under instead
 * of against numbers copied out of the rulebook.
 *
 * Two conventions hold throughout:
 *
 * - Every scalar has a default, so any group can be given partially.
 * - A leaf value object — a sight, a generation roll, a conversion — is supplied
 *   whole or not at all. Half of one is never inherited from a default that was
 *   chosen for something else.
 */
const rulesSchema = z.object({
  world: worldRulesSchema.prefault({}),
  android: androidRulesSchema.prefault({}),
  buildings: buildingsRulesSchema.prefault({}),
  salvage: salvageRulesSchema.prefault({}),
  scoring: scoringRulesSchema.prefault({}),
  match: matchRulesSchema.prefault({}),
});

/** Resolved rules: every value present, which is what mechanics and scripts read. */
type Rules = z.infer<typeof rulesSchema>;

/** What a host supplies: any subset, to any depth allowed by the conventions above. */
type RulesInput = z.input<typeof rulesSchema>;

const resolveRules = (rules: RulesInput = {}): Rules => rulesSchema.parse(rules);

/** The shipped game. */
const defaultRules: Rules = resolveRules();

/**
 * The rules as they are true of one built world.
 *
 * `world.width` and `world.height` are generation parameters, and a world is
 * only generated once: `game.create-map` leaves an already-populated world
 * alone, so a hand-authored scenario or a recording made under different rules
 * has whatever board it was written with. Scripts are handed the board they are
 * standing on, measured from its tiles, so that reading `rules.world.width` is
 * never a worse answer than probing for a missing neighbour.
 */
const rulesForWorld = (rules: Rules, world: World): Rules =>
  world.tiles.length === 0 ? rules : { ...rules, world: { ...rules.world, ...getWorldSize(world) } };

export type { MatchRules, Rules, RulesInput };
export { defaultRules, matchRulesSchema, resolveRules, rulesForWorld, rulesSchema };
