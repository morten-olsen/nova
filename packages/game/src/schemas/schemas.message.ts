import { z } from 'zod';

import { idSchema, positionSchema } from './schemas.base.js';

const messageSchema = z.object({
  id: idSchema,
  senderAndroidId: idSchema,
  ownerId: idSchema,
  position: positionSchema,
  content: z.string(),
  round: z.number().optional(),
});

type Message = z.infer<typeof messageSchema>;

export type { Message };
export { messageSchema };
