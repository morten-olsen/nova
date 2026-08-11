import { z } from 'zod';

import { idSchema } from './schemas.base.js';

const playerSchema = z.object({
  id: idSchema,
  name: z.string(),
});

type Player = z.infer<typeof playerSchema>;

export type { Player };
export { playerSchema };
