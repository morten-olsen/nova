import { readFile, writeFile } from 'node:fs/promises';

import { createBaseRuleset, Loop, parseRecording, Rules, World, type GameRecording } from '@morten-olsen/nova-game';
import { createQuickJsScriptRunner } from '@morten-olsen/nova-script-runner';

/**
 * A game file is a recording plus its future: the CLI keeps appending events to
 * the same document it hands the replay viewer, so the two share one schema.
 */
type GameFile = GameRecording;

/**
 * The rules are stored with the world they generated, because every later
 * command replays this file: a game created with a retuned ruleset has to be
 * continued under the same one, or the events would land in a different world.
 */
const createGameFile = (world: World, rules: Rules): GameFile => ({
  version: 1,
  initialWorld: structuredClone(world),
  rules,
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
    ruleset: createBaseRuleset(gameFile.rules),
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
