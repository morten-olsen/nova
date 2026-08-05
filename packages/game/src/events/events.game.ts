import { z } from 'zod';

import { idSchema } from '../schemas/schemas.base.js';

const gameRoundStartEventSchema = z.object({
  type: z.literal('game.round-start'),
});

type GameRoundStartEvent = z.infer<typeof gameRoundStartEventSchema>;

const gameRoundEndEventSchema = z.object({
  type: z.literal('game.round-end'),
});

type GameRoundEndEvent = z.infer<typeof gameRoundEndEventSchema>;

const androidFailedTurnEventSchema = z.object({
  type: z.literal('game.android-failed-turn'),
  androidId: idSchema,
  error: z.object({
    message: z.string(),
  }),
});

type AndroidFailedTurnEvent = z.infer<typeof androidFailedTurnEventSchema>;

const gameEventSchema = z.union([gameRoundStartEventSchema, gameRoundEndEventSchema, androidFailedTurnEventSchema]);

type GameEvent = z.infer<typeof gameEventSchema>;

export type { GameRoundStartEvent, GameRoundEndEvent, GameEvent, AndroidFailedTurnEvent };
export { gameRoundStartEventSchema, gameRoundEndEventSchema, gameEventSchema, androidFailedTurnEventSchema };
