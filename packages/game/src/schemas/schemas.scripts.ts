import { z } from 'zod';

import { idSchema } from './schemas.base.js';

const scriptSchema = z.object({
  id: idSchema,
  ownerId: idSchema,
  name: z.string(),
  content: z.string(),
});

type Script = z.infer<typeof scriptSchema>;

export type { Script };
export { scriptSchema };
