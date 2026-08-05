import { z } from 'zod';

import { androidEventSchema } from './events.android.js';
import { gameEventSchema } from './events.game.js';
import { userEventSchema } from './events.user.js';

const eventSchema = z.union([gameEventSchema, androidEventSchema, userEventSchema]);

type Event = z.infer<typeof eventSchema>;

export * from './events.game.js';
export * from './events.user.js';
export * from './events.android.js';
export type { Event };
export { eventSchema };
