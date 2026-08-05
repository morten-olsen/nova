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
});

type World = z.infer<typeof worldSchema>;

export type { World };
export { worldSchema };
