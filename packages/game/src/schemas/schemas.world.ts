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
   * The round the match is scheduled to end on, counted the same way as
   * {@link round}.
   *
   * No ruleset sets this yet — it is carried so that scripts can already ask
   * "how long do I have left?" through the `finalTurn` global, and so that a
   * future timed ruleset can start populating it without a recording format
   * change. Absent means the match has no scheduled end.
   */
  finalRound: z.number().optional(),
});

type World = z.infer<typeof worldSchema>;

export type { World };
export { worldSchema };
