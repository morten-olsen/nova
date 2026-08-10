import { z } from 'zod';

import { idSchema, positionSchema } from './schemas.base.js';
import { materialBundleSchema } from './schemas.resources.js';

const androidMemoryLimit = 4_096;
const androidRecordingLimit = 16_384;

const androidSchema = z.object({
  id: idSchema,
  ownerId: idSchema,
  scriptId: idSchema,
  position: positionSchema,
  battery: z.number(),
  health: z.number(),
  active: z.boolean(),
  cargo: materialBundleSchema.optional(),
  memory: z.string().max(androidMemoryLimit).default(''),
  recording: z.string().max(androidRecordingLimit).default(''),
});

type Android = z.infer<typeof androidSchema>;

export type { Android };
export { androidMemoryLimit, androidRecordingLimit, androidSchema };
