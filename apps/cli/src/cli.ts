#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve, basename } from 'node:path';
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';

import { calculateColonyScores, createBaseRuleset, Loop, type Event } from '@morten-olsen/nova-game';
import { disclosureSchema, type Disclosure } from '@morten-olsen/nova-match';
import { createQuickJsScriptRunner } from '@morten-olsen/nova-script-runner';

import {
  createGameFile,
  createLoopFromGameFile,
  readGameFile,
  updateGameFileFromLoop,
  writeGameFile,
} from './game-file.js';
import { loadAndroidScript } from './android-script.js';
import { createFactory, updateFactory } from './factory.js';
import { createPlayServer, listenOnRandomPort } from './play-server.js';
import { hostGame } from './match-host.js';
import { joinGame } from './match-guest.js';
import { formatScores } from './match-files.js';

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
      disclosure: { type: 'string' },
      out: { type: 'string', short: 'o' },
      yes: { type: 'boolean', short: 'y' },
      help: { type: 'boolean', short: 'h' },
    },
  });
};

const usage = `Usage:
  nova init [factory-folder]
  nova create-game --file game.json [--width 16 --height 16]
  nova update
  nova status --file game.json
  nova upload-script --file game.json --owner player-1 --name miner --script bot/android.ts
  nova launch-android --file game.json --owner player-1 --script-id script-1
  nova run --file game.json [--rounds 1]
  nova play --file game.json
  nova host --script bot/android.ts [--rounds 20] [--disclosure full|recording]
  nova join ABCDE-FGHJK --script bot/android.ts

Game files store the generated initial world plus the complete event log.

--script takes the entry file of an Android. It is compiled and bundled before
it is uploaded, so it may be TypeScript and may import other files.

host and join play one Android against another over a peer-to-peer connection.
The host picks the rounds and the disclosure mode, and shares the invite code.
`;

const createGame = async (values: Record<string, string | boolean | undefined>): Promise<CommandResult> => {
  const file = resolvePath(requireString(values.file, 'file'));
  const width = optionalNumber(values.width, 16);
  const height = optionalNumber(values.height, 16);
  const loop = new Loop({
    ruleset: createBaseRuleset({
      world: { width, height },
    }),
    scriptRunner: createQuickJsScriptRunner(),
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
  const scoreLines = calculateColonyScores(world).flatMap((score) => [
    `  ${score.playerName} (${score.playerId}): ${score.total}`,
    ...score.contributors.map(
      (contributor) => `    ${contributor.label}: ${contributor.quantity} = ${contributor.points}`,
    ),
  ]);

  return {
    message: [
      `World: ${world.tiles.length} tiles`,
      `Events: ${loop.events.length}`,
      `Scripts: ${world.scripts.length}`,
      `Androids: ${world.androids.length} (${activeAndroids} active)`,
      ...androidLines,
      `Buildings: ${world.buildings.length}`,
      'Colony readiness:',
      ...(scoreLines.length ? scoreLines : ['  No players.']),
    ].join('\n'),
  };
};

const uploadScript = async (values: Record<string, string | boolean | undefined>): Promise<CommandResult> => {
  const file = resolvePath(requireString(values.file, 'file'));
  const ownerId = requireString(values.owner, 'owner');
  const name = requireString(values.name, 'name');
  const scriptPath = resolvePath(requireString(values.script, 'script'));
  const content = await loadAndroidScript(scriptPath);
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

const openBrowser = (url: string): void => {
  const [command, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]];
  const browser = spawn(command, args, { detached: true, stdio: 'ignore' });
  browser.on('error', () => undefined);
  browser.unref();
};

const play = async (values: Record<string, string | boolean | undefined>): Promise<CommandResult> => {
  const file = resolvePath(requireString(values.file, 'file'));
  const gameContent = await readFile(file, 'utf8');
  createLoopFromGameFile(await readGameFile(file));

  const server = createPlayServer(gameContent, basename(file));
  const port = await listenOnRandomPort(server);
  const url = `http://127.0.0.1:${port}`;
  openBrowser(url);

  const closeServer = (): void => {
    server.close();
  };
  process.once('SIGINT', closeServer);
  process.once('SIGTERM', closeServer);

  return { message: `Opening replay at ${url}\nPress Ctrl+C to stop the replay server.` };
};

const requireDisclosure = (value: string | boolean | undefined): Disclosure => {
  if (value === undefined) {
    return 'full';
  }

  const parsed = disclosureSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`--disclosure must be "full" or "recording", received: ${String(value)}`);
  }

  return parsed.data;
};

/** Progress goes out as it happens; a peer match is too slow to report only at the end. */
const report = (message: string): void => {
  console.log(message);
};

const host = async (values: Record<string, string | boolean | undefined>): Promise<CommandResult> => {
  const scriptPath = resolvePath(requireString(values.script, 'script'));
  const disclosure = requireDisclosure(values.disclosure);
  const rounds = optionalNumber(values.rounds, 20);
  const outputPath = resolvePath(
    typeof values.out === 'string' ? values.out : disclosure === 'full' ? 'match.json' : 'match-recording.json',
  );

  const result = await hostGame({
    scriptPath,
    scriptName: basename(scriptPath),
    playerName: typeof values.name === 'string' ? values.name : 'host',
    rounds,
    width: optionalNumber(values.width, 16),
    height: optionalNumber(values.height, 16),
    disclosure,
    outputPath,
    report,
  });

  return {
    message: [
      '',
      'Match complete.',
      ...formatScores(result.scores),
      '',
      `Wrote ${result.outputPath}`,
      disclosure === 'full'
        ? `Replay it with: npx nova play --file ${result.outputPath}`
        : "Only your own Android's recording and the final scores were kept.",
    ].join('\n'),
  };
};

const join = async (
  values: Record<string, string | boolean | undefined>,
  code: string | undefined,
): Promise<CommandResult> => {
  if (!code) {
    throw new Error('Missing invite code. Usage: nova join <invite-code> --script bot/android.js');
  }

  const scriptPath = resolvePath(requireString(values.script, 'script'));
  const result = await joinGame({
    code,
    scriptPath,
    scriptName: basename(scriptPath),
    playerName: typeof values.name === 'string' ? values.name : 'guest',
    // The guest only learns the disclosure mode from the host's offer, so the
    // default filename cannot be chosen until then.
    outputPath: typeof values.out === 'string' ? resolvePath(values.out) : undefined,
    resolveDefaultOutputPath: (disclosure) =>
      resolvePath(disclosure === 'full' ? 'match.json' : 'match-recording.json'),
    assumeYes: values.yes === true,
    report,
  });

  return {
    message: [
      '',
      'Match complete.',
      ...formatScores(result.scores),
      '',
      `Wrote ${result.outputPath}`,
      result.disclosure === 'full'
        ? `Replay it with: npx nova play --file ${result.outputPath}`
        : "Only your own Android's recording and the final scores were disclosed.",
    ].join('\n'),
  };
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

    if (command === 'play') {
      return play(values);
    }

    if (command === 'host') {
      return host(values);
    }

    if (command === 'join') {
      return join(values, directory);
    }

    throw new Error(`Unknown command: ${command}\n\n${usage}`);
  })();

  console.log(result.message);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
