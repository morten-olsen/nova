import { readFile, writeFile } from 'node:fs/promises';

import { createBaseRuleset, Loop, World, eventSchema, worldSchema } from '@morten-olsen/nova-game';
import { z } from 'zod';

const gameFileSchema = z.object({
  version: z.literal(1),
  initialWorld: worldSchema,
  events: eventSchema.array(),
});

type GameFile = z.infer<typeof gameFileSchema>;

const createGameFile = (world: World): GameFile => ({
  version: 1,
  initialWorld: structuredClone(world),
  events: [],
});

const readGameFile = async (path: string): Promise<GameFile> => {
  const content = await readFile(path, 'utf8');
  return gameFileSchema.parse(JSON.parse(content));
};

const writeGameFile = async (path: string, gameFile: GameFile): Promise<void> => {
  await writeFile(path, `${JSON.stringify(gameFile, null, 2)}\n`);
};

const createLoopFromGameFile = (gameFile: GameFile): Loop => {
  return new Loop({
    ruleset: createBaseRuleset(),
    initWorld: gameFile.initialWorld,
    events: gameFile.events,
  });
};

const updateGameFileFromLoop = (gameFile: GameFile, loop: Loop): GameFile => ({
  ...gameFile,
  events: loop.events,
});

export type { GameFile };
export { createGameFile, createLoopFromGameFile, readGameFile, updateGameFileFromLoop, writeGameFile };
