import { readFile, writeFile } from 'node:fs/promises';

import { createBaseRuleset, Loop, parseRecording, World, type GameRecording } from '@morten-olsen/nova-game';
import { createQuickJsScriptRunner } from '@morten-olsen/nova-script-runner';

/**
 * A game file is a recording plus its future: the CLI keeps appending events to
 * the same document it hands the replay viewer, so the two share one schema.
 */
type GameFile = GameRecording;

const createGameFile = (world: World): GameFile => ({
  version: 1,
  initialWorld: structuredClone(world),
  events: [],
});

const readGameFile = async (path: string): Promise<GameFile> => {
  const content = await readFile(path, 'utf8');
  return parseRecording(content);
};

const writeGameFile = async (path: string, gameFile: GameFile): Promise<void> => {
  await writeFile(path, `${JSON.stringify(gameFile, null, 2)}\n`);
};

const createLoopFromGameFile = (gameFile: GameFile): Loop => {
  return new Loop({
    ruleset: createBaseRuleset(),
    initWorld: gameFile.initialWorld,
    events: gameFile.events,
    scriptRunner: createQuickJsScriptRunner(),
  });
};

const updateGameFileFromLoop = (gameFile: GameFile, loop: Loop): GameFile => ({
  ...gameFile,
  events: loop.events,
});

export type { GameFile };
export { createGameFile, createLoopFromGameFile, readGameFile, updateGameFileFromLoop, writeGameFile };
