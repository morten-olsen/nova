#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { createBaseRuleset, Loop, type Event } from '@morten-olsen/nova-game';

import {
  createGameFile,
  createLoopFromGameFile,
  readGameFile,
  updateGameFileFromLoop,
  writeGameFile,
} from './game-file.js';
import { createFactory, updateFactory } from './factory.js';

type CommandResult = {
  message: string;
};

const resolvePath = (path: string): string => {
  if (isAbsolute(path)) {
    return path;
  }

  return resolve(process.env.INIT_CWD ?? process.cwd(), path);
};

const requireString = (value: string | boolean | undefined, name: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing required option: --${name}`);
  }

  return value;
};

const optionalNumber = (value: string | boolean | undefined, fallback: number): number => {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== 'string') {
    throw new Error('Expected numeric option value');
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected positive integer, received: ${value}`);
  }

  return parsed;
};

const getOptions = () => {
  return parseArgs({
    allowPositionals: true,
    options: {
      file: { type: 'string', short: 'f' },
      width: { type: 'string' },
      height: { type: 'string' },
      owner: { type: 'string' },
      name: { type: 'string' },
      script: { type: 'string' },
      'script-id': { type: 'string' },
      rounds: { type: 'string', short: 'r' },
      help: { type: 'boolean', short: 'h' },
    },
  });
};

const usage = `Usage:
  nova init [factory-folder]
  nova create-game --file game.json [--width 16 --height 16]
  nova update
  nova status --file game.json
  nova upload-script --file game.json --owner player-1 --name miner --script ./bot.js
  nova launch-android --file game.json --owner player-1 --script-id script-1
  nova run --file game.json [--rounds 1]

Game files store the generated initial world plus the complete event log.
`;

const createGame = async (values: Record<string, string | boolean | undefined>): Promise<CommandResult> => {
  const file = resolvePath(requireString(values.file, 'file'));
  const width = optionalNumber(values.width, 16);
  const height = optionalNumber(values.height, 16);
  const loop = new Loop({
    ruleset: createBaseRuleset({
      world: { width, height },
    }),
  });

  await writeGameFile(file, createGameFile(loop.world));
  return { message: `Created ${file} with ${width}x${height} world.` };
};

const status = async (values: Record<string, string | boolean | undefined>): Promise<CommandResult> => {
  const file = resolvePath(requireString(values.file, 'file'));
  const gameFile = await readGameFile(file);
  const loop = createLoopFromGameFile(gameFile);
  const world = loop.world;
  const activeAndroids = world.androids.filter((android) => android.active).length;

  const androidLines = world.androids.map((android) => {
    return `  ${android.id}: owner=${android.ownerId} position=${android.position.x},${android.position.y} battery=${android.battery} active=${android.active}`;
  });

  return {
    message: [
      `World: ${world.tiles.length} tiles`,
      `Events: ${loop.events.length}`,
      `Scripts: ${world.scripts.length}`,
      `Androids: ${world.androids.length} (${activeAndroids} active)`,
      ...androidLines,
      `Buildings: ${world.buildings.length}`,
    ].join('\n'),
  };
};

const uploadScript = async (values: Record<string, string | boolean | undefined>): Promise<CommandResult> => {
  const file = resolvePath(requireString(values.file, 'file'));
  const ownerId = requireString(values.owner, 'owner');
  const name = requireString(values.name, 'name');
  const scriptPath = resolvePath(requireString(values.script, 'script'));
  const content = await readFile(scriptPath, 'utf8');
  const gameFile = await readGameFile(file);
  const loop = createLoopFromGameFile(gameFile);
  const event: Event = {
    type: 'user.upload-android-script',
    ownerId,
    name,
    content,
  };

  loop.applyEvents([event]);
  await writeGameFile(file, updateGameFileFromLoop(gameFile, loop));

  return { message: `Uploaded script as script-${loop.world.scripts.length}.` };
};

const launchAndroid = async (values: Record<string, string | boolean | undefined>): Promise<CommandResult> => {
  const file = resolvePath(requireString(values.file, 'file'));
  const ownerId = requireString(values.owner, 'owner');
  const scriptId = requireString(values['script-id'], 'script-id');
  const gameFile = await readGameFile(file);
  const loop = createLoopFromGameFile(gameFile);
  const event: Event = {
    type: 'user.launch-android',
    ownerId,
    scriptId,
  };

  loop.applyEvents([event]);
  await writeGameFile(file, updateGameFileFromLoop(gameFile, loop));

  return { message: `Launched android-${loop.world.androids.length}.` };
};

const runRounds = async (values: Record<string, string | boolean | undefined>): Promise<CommandResult> => {
  const file = resolvePath(requireString(values.file, 'file'));
  const rounds = optionalNumber(values.rounds, 1);
  const gameFile = await readGameFile(file);
  const loop = createLoopFromGameFile(gameFile);

  for (let round = 0; round < rounds; round += 1) {
    await loop.run();
  }

  await writeGameFile(file, updateGameFileFromLoop(gameFile, loop));
  return { message: `Ran ${rounds} round(s). Events: ${loop.events.length}.` };
};

const main = async (): Promise<void> => {
  const { positionals, values } = getOptions();
  const [command, directory] = positionals;

  if (values.help || !command) {
    console.log(usage);
    return;
  }

  const result = await (async (): Promise<CommandResult> => {
    if (command === 'init') {
      if (values.file) {
        return createGame(values);
      }

      const factoryDirectory = await createFactory({ directory });
      return {
        message: `Created Android factory at ${factoryDirectory}.\n\nNext: cd ${directory ?? '<factory-folder>'} && npx nova create-game --file game.json`,
      };
    }

    if (command === 'create-game') {
      return createGame(values);
    }

    if (command === 'update') {
      const factoryDirectory = await updateFactory();
      return { message: `Updated Nova packages and docs in ${factoryDirectory}.` };
    }

    if (command === 'status') {
      return status(values);
    }

    if (command === 'upload-script') {
      return uploadScript(values);
    }

    if (command === 'launch-android') {
      return launchAndroid(values);
    }

    if (command === 'run') {
      return runRounds(values);
    }

    throw new Error(`Unknown command: ${command}\n\n${usage}`);
  })();

  console.log(result.message);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
