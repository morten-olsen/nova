import { z } from 'zod';

import { positionSchema } from './schemas.base.js';
import { materialBundleSchema, tileCompositionSchema } from './schemas.resources.js';

type TileComposition = z.infer<typeof tileCompositionSchema>;

const tileSchema = z.object({
  position: positionSchema,
  composition: tileCompositionSchema,
  scattered: materialBundleSchema.optional(),
  revealedBy: z.array(z.string()).optional(),
});

type Tile = z.infer<typeof tileSchema>;

export type { TileComposition, Tile };
export { tileCompositionSchema, tileSchema };
