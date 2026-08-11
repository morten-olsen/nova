import { z } from 'zod';

import { tileSchema } from './schemas.tile.js';
import { androidSchema } from './schemas.android.js';
import { buildingSchema } from './schemas.building.js';
import { scriptSchema } from './schemas.scripts.js';
import { playerSchema } from './schemas.player.js';
import { messageSchema } from './schemas.message.js';

const worldSchema = z.object({
  scripts: scriptSchema.array(),
  tiles: tileSchema.array(),
  androids: androidSchema.array(),
  buildings: buildingSchema.array(),
  players: playerSchema.array().optional(),
  messages: messageSchema.array().optional(),
  round: z.number().optional(),
  /**
   * The round the humans are expected to arrive on, which is the round the match
   * is scheduled to end on. Counted the same way as {@link round}.
   *
   * Written at setup from `rules.match.finalRound`, and absent when that rule is
   * `null` — a match with no arrival date, which is how an open-ended sandbox
   * game is played. It lives in the world rather than only in the rules because
   * scripts read it as the `finalTurn` global.
   */
  finalRound: z.number().optional(),
});

type World = z.infer<typeof worldSchema>;

export type { World };
export { worldSchema };
