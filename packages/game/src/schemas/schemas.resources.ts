import { z } from 'zod';

const materialKeys = ['metal', 'electronics', 'polymer', 'ore', 'water', 'acidCanister'] as const;

/** One bundle shape, over whatever a single amount is allowed to be. */
const materialBundleOf = <Amount extends z.ZodType<number>>(amount: Amount) =>
  z.object({
    metal: amount.optional(),
    electronics: amount.optional(),
    polymer: amount.optional(),
    ore: amount.optional(),
    water: amount.optional(),
    acidCanister: amount.optional(),
  });

const materialBundleSchema = materialBundleOf(z.number());

type MaterialBundle = z.infer<typeof materialBundleSchema>;

/**
 * A bundle an action asks for, which is never negative.
 *
 * Every mechanic that moves material moves `requested` from one side to the
 * other, so a negative amount is that action run backwards: depositing minus ten
 * metal mints ten into cargo and takes ten out of a depot, ignoring cargo
 * capacity on the way. Refusing it here is what keeps each mechanic's own check
 * — "does the android have this?", "does the site need this?" — meaningful.
 */
const materialRequestSchema = materialBundleOf(z.number().min(0));

type MaterialRequest = z.infer<typeof materialRequestSchema>;

const tileCompositionSchema = z.object({
  ore: z.number().optional(),
  acid: z.number().optional(),
  water: z.number().optional(),
  radiation: z.number().optional(),
});

type TileComposition = z.infer<typeof tileCompositionSchema>;

const emptyMaterials = (): MaterialBundle => ({
  metal: 0,
  electronics: 0,
  polymer: 0,
  ore: 0,
  water: 0,
  acidCanister: 0,
});

const normalizeMaterials = (materials: Partial<MaterialBundle> | undefined): MaterialBundle => {
  const normalized = emptyMaterials();
  for (const key of materialKeys) {
    normalized[key] = materials?.[key] ?? 0;
  }
  return normalized;
};

const addMaterials = (target: Partial<MaterialBundle> | undefined, source: Partial<MaterialBundle>): MaterialBundle => {
  const result = normalizeMaterials(target);
  for (const key of materialKeys) {
    result[key] = (result[key] ?? 0) + (source[key] ?? 0);
  }
  return result;
};

const subtractMaterials = (
  target: Partial<MaterialBundle> | undefined,
  source: Partial<MaterialBundle>,
): MaterialBundle => {
  const result = normalizeMaterials(target);
  for (const key of materialKeys) {
    result[key] = (result[key] ?? 0) - (source[key] ?? 0);
  }
  return result;
};

const hasMaterials = (target: Partial<MaterialBundle> | undefined, source: Partial<MaterialBundle>): boolean => {
  for (const key of materialKeys) {
    if ((target?.[key] ?? 0) < (source[key] ?? 0)) {
      return false;
    }
  }
  return true;
};

/** Total units in a bundle, which is what capacities and payments are measured in. */
const materialAmount = (materials: Partial<MaterialBundle> | undefined): number =>
  materialKeys.reduce((total, key) => total + (materials?.[key] ?? 0), 0);

export type { MaterialBundle, MaterialRequest, TileComposition };
export {
  addMaterials,
  emptyMaterials,
  hasMaterials,
  materialAmount,
  materialBundleSchema,
  materialKeys,
  materialRequestSchema,
  normalizeMaterials,
  subtractMaterials,
  tileCompositionSchema,
};
