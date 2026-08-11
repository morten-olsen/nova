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

type BuildingRulesDefaults = {
  cost: MaterialBundle;
  ticks: number;
  health?: number;
  charge?: number;
  androidCapacity?: number;
  sight?: SightRules;
  storage?: StorageRules;
  extraction?: MaterialBundle;
  conversion?: ConversionRules;
  cleansAcid?: boolean;
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
      conversion: conversionRulesSchema.nullable().prefault(defaults.conversion ?? null),
      /** Lets its owner's Androids clean acid from adjacent tiles, and banks the canisters. */
      cleansAcid: z.boolean().default(defaults.cleansAcid ?? false),
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
  charger: buildingRulesSchema({ cost: { metal: 10 }, ticks: 2, charge: 25, androidCapacity: 1 }),
  'relay-tower': buildingRulesSchema({ cost: { metal: 8, electronics: 4 }, ticks: 3 }),
  depot: buildingRulesSchema({ cost: { metal: 6 }, ticks: 2, storage: { deposit: true, withdraw: true } }),
  extractor: buildingRulesSchema({
    cost: { metal: 12, electronics: 2 },
    ticks: 5,
    // Nothing to deposit into an extractor: it fills itself, and hauling
    // material into one is how it would become a depot that also mines.
    storage: { deposit: false, withdraw: true },
    extraction: { ore: 2, water: 1, acidCanister: 1 },
  }),
  processor: buildingRulesSchema({
    cost: { metal: 15, electronics: 4, polymer: 2 },
    ticks: 6,
    storage: { deposit: true, withdraw: true },
    conversion: { input: { ore: 2 }, output: { metal: 1 } },
  }),
  'acid-processing-plant': buildingRulesSchema({
    cost: { metal: 12, electronics: 3, polymer: 2 },
    ticks: 5,
    storage: { deposit: true, withdraw: true },
    cleansAcid: true,
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
  /** Damage per action against another player's building. */
  hostileDamage: z.number().min(0).default(10),
  /** Share of the build cost scattered on the tile when its owner finishes it off. */
  ownReturnRate: z.number().min(0).max(1).default(0.6),
  /** Share of the build cost scattered on the tile after a hostile salvage. */
  hostileReturnRate: z.number().min(0).max(1).default(0.35),
});

type SalvageRules = z.infer<typeof salvageRulesSchema>;

export type { BuildingRules, BuildingsRules, ConversionRules, SalvageRules, StorageRules };
export { buildingRulesSchema, buildingsRulesSchema, conversionRulesSchema, salvageRulesSchema, storageRulesSchema };
