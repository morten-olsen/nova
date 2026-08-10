import { z } from 'zod';

import { idSchema, positionSchema } from './schemas.base.js';
import { materialBundleSchema } from './schemas.resources.js';

const buildingTypeSchema = z.enum([
  'charger',
  'relay-tower',
  'depot',
  'extractor',
  'processor',
  'acid-processing-plant',
  'scanner',
  'radar',
  'colony-module',
]);

type BuildingType = z.infer<typeof buildingTypeSchema>;

const buildingResourcesSchema = materialBundleSchema;

type BuildingResources = z.infer<typeof buildingResourcesSchema>;

const buildingSchema = z.object({
  id: idSchema,
  ownerId: idSchema,
  type: buildingTypeSchema,
  position: positionSchema,
  health: z.number().default(100),
  storage: buildingResourcesSchema.optional(),
  initial: z.boolean().default(false),
  remainingConstruction: z.object({
    ticks: z.number(),
    resources: buildingResourcesSchema,
  }),
});

type Building = z.infer<typeof buildingSchema>;

export type { BuildingType, BuildingResources, Building };
export { buildingTypeSchema, buildingResourcesSchema, buildingSchema };
