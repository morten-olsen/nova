import { z } from 'zod';

import { idSchema, positionSchema } from './schemas.base.js';
import { materialBundleSchema } from './schemas.resources.js';

/**
 * Note what is *not* here: a maximum on `memory` or `recording`. Both are rules
 * (`rules.android.memoryLimit`, `rules.android.recordingLimit`) and are enforced
 * by `android.update-state` when a turn writes them, so a ruleset can hand
 * Androids a bigger notebook without a schema change.
 */
const androidSchema = z.object({
  id: idSchema,
  ownerId: idSchema,
  scriptId: idSchema,
  position: positionSchema,
  battery: z.number(),
  health: z.number(),
  active: z.boolean(),
  cargo: materialBundleSchema.optional(),
  memory: z.string().default(''),
  recording: z.string().default(''),
});

type Android = z.infer<typeof androidSchema>;

export type { Android };
export { androidSchema };
