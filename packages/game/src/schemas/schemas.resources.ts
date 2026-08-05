import { z } from 'zod';

const materialKeys = ['metal', 'electronics', 'polymer', 'ore', 'water', 'acidCanister'] as const;

const materialBundleSchema = z.object({
  metal: z.number().optional(),
  electronics: z.number().optional(),
  polymer: z.number().optional(),
  ore: z.number().optional(),
  water: z.number().optional(),
  acidCanister: z.number().optional(),
});

type MaterialBundle = z.infer<typeof materialBundleSchema>;

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

export type { MaterialBundle, TileComposition };
export {
  addMaterials,
  emptyMaterials,
  hasMaterials,
  materialBundleSchema,
  materialKeys,
  normalizeMaterials,
  subtractMaterials,
  tileCompositionSchema,
};
