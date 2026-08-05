import { z } from 'zod';

import { idSchema, positionSchema } from './schemas.base.js';
import { materialBundleSchema } from './schemas.resources.js';

const androidSchema = z.object({
  id: idSchema,
  ownerId: idSchema,
  scriptId: idSchema,
  position: positionSchema,
  battery: z.number(),
  health: z.number(),
  active: z.boolean(),
  cargo: materialBundleSchema.optional(),
});

type Android = z.infer<typeof androidSchema>;

export type { Android };
export { androidSchema };
