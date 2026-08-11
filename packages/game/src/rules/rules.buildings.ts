import { z } from 'zod';

import type { BuildingType } from '../schemas/schemas.building.js';
import { materialBundleSchema, type MaterialBundle } from '../schemas/schemas.resources.js';

import { sightRulesSchema, type SightRules } from './rules.sight.js';

/** Whether a building holds material, and which way material may move through it. */
const storageRulesSchema = z.object({
  deposit: z.boolean(),
  withdraw: z.boolean(),
});

type StorageRules = z.infer<typeof storageRulesSchema>;

/** A round-end conversion run inside one building's own storage. */
const conversionRulesSchema = z.object({
  input: materialBundleSchema,
  output: materialBundleSchema,
});

type ConversionRules = z.infer<typeof conversionRulesSchema>;

/**
 * The recipes one building runs, given as one or as a list.
 *
 * A list because a refinery that can only ever do one thing makes the material
 * it does not produce unobtainable: electronics and polymer were finite, so the
 * buildings that need them were capped by whatever the pods happened to scatter.
 * Recipes run in the order given, on the same storage, so a later one can
 * consume what an earlier one just made.
 *
 * A single recipe is still accepted, and resolves to a list of one, so a rules
 * file or a recording written against the old shape means exactly what it did.
 */
const conversionsRulesSchema = z
  .union([conversionRulesSchema, conversionRulesSchema.array()])
  .transform((value): ConversionRules[] => (Array.isArray(value) ? value : [value]));

type BuildingRulesDefaults = {
  cost: MaterialBundle;
  ticks: number;
  health?: number;
  charge?: number;
  androidCapacity?: number;
  sight?: SightRules;
  storage?: StorageRules;
  extraction?: MaterialBundle;
  conversion?: ConversionRules | ConversionRules[];
  cleansAcid?: boolean;
  salvageableByOthers?: boolean;
};

/**
 * One building type, described entirely by what it costs and what it does.
 *
 * Behaviour is read off these fields rather than off the type name, so the
 * mechanics ask "does this building charge?" instead of "is this a charger?".
 * That is what makes the table below a balance sheet: moving `androidCapacity`
 * onto depots is a rules change, not a code change.
 */
const buildingRulesSchema = (defaults: BuildingRulesDefaults) =>
  z
    .object({
      cost: materialBundleSchema.prefault(defaults.cost),
      ticks: z.int().min(0).prefault(defaults.ticks),
      health: z
        .number()
        .positive()
        .default(defaults.health ?? 100),
      /** Battery one `android.charge` restores here. `0` means it cannot charge. */
      charge: z
        .number()
        .min(0)
        .default(defaults.charge ?? 0),
      /**
       * Active Androids one completed building of this type allows its owner,
       * and — when above zero — whether it doubles as a deployment bay an
       * Android can launch and retire siblings from.
       */
      androidCapacity: z
        .int()
        .min(0)
        .default(defaults.androidCapacity ?? 0),
      /** Revealed around a completed building every round. `null` sees nothing. */
      sight: sightRulesSchema.nullable().prefault(defaults.sight ?? null),
      storage: storageRulesSchema.nullable().prefault(defaults.storage ?? null),
      /**
       * Harvested into storage at round end, capped per material by this bundle
       * and by what the tile's composition holds. Composition is not consumed.
       * Only `ore`, `water` and `acidCanister` have a composition to draw from.
       */
      extraction: materialBundleSchema.nullable().prefault(defaults.extraction ?? null),
      conversion: conversionsRulesSchema.nullable().prefault(defaults.conversion ?? null),
      /** Lets its owner's Androids clean acid from adjacent tiles, and banks the canisters. */
      cleansAcid: z.boolean().default(defaults.cleansAcid ?? false),
      /**
       * Whether another player's Android may salvage this building.
       *
       * `false` is what makes a store of material safe once it has been banked.
       * Denying a rival 40 points and a full stockpile for ten turns of standing
       * still was the best-paid action in the game, and a colony that cannot
       * protect what it has already earned is a colony playing a different game
       * from the one about logistics. The owner can still take their own down —
       * see `android.salvage` — so a badly placed depot is not permanent.
       */
      salvageableByOthers: z.boolean().default(defaults.salvageableByOthers ?? true),
    })
    .prefault({});

type BuildingRules = z.infer<ReturnType<typeof buildingRulesSchema>>;

/**
 * Every building type in the game.
 *
 * `satisfies` is load-bearing: adding a type to `buildingTypeSchema` breaks the
 * build here until it is given a cost and a construction time, which is the
 * point at which a half-added building would otherwise compile and do nothing.
 */
const buildingsRulesSchema = z.object({
  // Two androids per charger, not one. The early game is turn-starved rather than
  // material-starved, and at one apiece a second android was eleven rounds of
  // income away — so every milestone waited on it. At two, an android standing on
  // its starting charger can launch a sibling on the first turn, and "double the
  // hands now or start scavenging now" becomes the opening decision.
  charger: buildingRulesSchema({ cost: { metal: 8 }, ticks: 2, charge: 25, androidCapacity: 2 }),
  'relay-tower': buildingRulesSchema({ cost: { metal: 8, electronics: 4 }, ticks: 3 }),
  depot: buildingRulesSchema({
    cost: { metal: 6 },
    ticks: 2,
    storage: { deposit: true, withdraw: true },
    // The one building a raider cannot take apart: material that reached a depot
    // is material that is safe.
    salvageableByOthers: false,
  }),
  extractor: buildingRulesSchema({
    // Twelve units: exactly one cargo hold, deliberately. At fourteen the first
    // building of the production tier needed a multi-trip delivery, and a measured
    // 150-round game never completed one.
    cost: { metal: 10, electronics: 2 },
    ticks: 3,
    // Nothing to deposit into an extractor: it fills itself, and hauling
    // material into one is how it would become a depot that also mines.
    storage: { deposit: false, withdraw: true },
    // Three ore and two water a round: one processor's appetite, so an extractor
    // on good ground keeps a refinery busy instead of half busy.
    extraction: { ore: 3, water: 2, acidCanister: 1 },
  }),
  processor: buildingRulesSchema({
    // Sixteen units, so still two loads: a refinery should be a project. Four
    // ticks rather than six, because a tick is a turn an android stands still.
    //
    // No polymer in the price. Polymer is manufactured rather than found, and a
    // building that costs its own industry's output can never be the first one
    // built — see `world.generation.scattered.polymer`.
    cost: { metal: 15, electronics: 3 },
    ticks: 4,
    storage: { deposit: true, withdraw: true },
    conversion: [
      { input: { ore: 2 }, output: { metal: 1 } },
      // Electronics are made, not found, and out of the metal economy rather than
      // beside it — a chip spends metal a colony could have banked.
      //
      // One metal, not two, because the line above makes one metal a round: at
      // two, the intermediate starved and a processor produced an electronics
      // every thirtieth round. Recipes that feed each other have to balance, or
      // the chain is a decoration.
      { input: { metal: 1, water: 1 }, output: { electronics: 1 } },
    ],
  }),
  'acid-processing-plant': buildingRulesSchema({
    // Nor here, and for the same reason: this is the building polymer comes from.
    cost: { metal: 12, electronics: 2 },
    ticks: 4,
    storage: { deposit: true, withdraw: true },
    cleansAcid: true,
    // Polymer out of the acid the plant was built to clean up, which is what
    // makes cleaning the planet pay for itself rather than only score. One
    // canister per polymer matches what an Android can clean in a turn.
    conversion: { input: { acidCanister: 1, water: 1 }, output: { polymer: 1 } },
  }),
  scanner: buildingRulesSchema({
    cost: { metal: 8, electronics: 6 },
    ticks: 4,
    sight: { range: 4, shape: 'stepped' },
  }),
  radar: buildingRulesSchema({
    cost: { metal: 14, electronics: 10, polymer: 2 },
    ticks: 7,
    sight: { range: 5, shape: 'circular' },
  }),
  'colony-module': buildingRulesSchema({ cost: { metal: 50, electronics: 20, polymer: 20 }, ticks: 12 }),
} satisfies Record<BuildingType, ReturnType<typeof buildingRulesSchema>>);

type BuildingsRules = z.infer<typeof buildingsRulesSchema>;

/**
 * Salvage is deliberately slow and lossy, and worse when it is someone else's
 * building: the return rates are what stop hostile salvage from being a cheaper
 * way to gather material than mining.
 */
const salvageRulesSchema = z.object({
  /** Damage per action against a building its own owner is taking apart. */
  ownDamage: z.number().min(0).default(25),
  /**
   * Building health one `android.repair` restores, capped at the building's own health.
   *
   * Ten against a raider's fifteen: one defender roughly cancels one attacker, so
   * holding ground is possible and never free. At twenty, one defender out-repaired
   * two raiders and infrastructure was simply safe.
   */
  repairAmount: z.number().min(0).default(10),
  /** What one repair action costs, taken from the repairing Android's cargo. */
  repairCost: materialBundleSchema.prefault({ metal: 1 }),
  /** Damage per action against another player's building. */
  hostileDamage: z.number().min(0).default(15),
  /** Share of the build cost scattered on the tile when its owner finishes it off. */
  ownReturnRate: z.number().min(0).max(1).default(0.6),
  /** Share of the build cost scattered on the tile after a hostile salvage. */
  hostileReturnRate: z.number().min(0).max(1).default(0.35),
});

type SalvageRules = z.infer<typeof salvageRulesSchema>;

export type { BuildingRules, BuildingsRules, ConversionRules, SalvageRules, StorageRules };
export { buildingRulesSchema, buildingsRulesSchema, conversionRulesSchema, salvageRulesSchema, storageRulesSchema };
