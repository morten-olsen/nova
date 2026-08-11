import { access, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

type FactoryOptions = {
  directory?: string;
};

const require = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);
const docsPackageDirectory = dirname(require.resolve('@morten-olsen/nova-docs/package.json'));

const cliVersion = (require('../package.json') as { version: string }).version;

const novaDependencies = {
  '@morten-olsen/nova': cliVersion,
  '@morten-olsen/nova-docs': cliVersion,
  '@morten-olsen/nova-game': cliVersion,
};

/**
 * TypeScript is a development dependency of the factory, not of an android: the
 * CLI compiles a bot on its way into the sandbox, so this is here for the
 * editor, and for `npm run check` to answer before a simulation does.
 */
const factoryDevDependencies = {
  typescript: '^5.9.2',
};

const packageJson = {
  name: 'nova-android-factory',
  version: '0.1.0',
  private: true,
  type: 'module',
  engines: { node: '>=24' },
  scripts: {
    check: 'tsc --noEmit',
    status: 'nova status --file game.json',
    simulate: 'nova run --file game.json --rounds 10',
    play: 'nova play --file game.json',
    host: 'nova host --script bot/starter-builder.ts --rounds 20',
  },
  dependencies: novaDependencies,
  devDependencies: factoryDevDependencies,
};

/**
 * The compiler settings an android is written under.
 *
 * `types` is the load-bearing line: it pulls in the sandbox globals — `world`,
 * `androidId`, `turn`, `finalTurn` — along with `Action` and the rest of the
 * game's model types, so a bot needs no imports to be fully typed. They are the
 * engine's own types, so they follow the game rather than a copy of it.
 *
 * The `lib` deliberately stops at the language. There is no `console`, no
 * `fetch`, and no `setTimeout` in the sandbox, and a bot that reaches for one
 * should be told here rather than by a failed turn.
 */
const tsconfigJson = {
  compilerOptions: {
    target: 'es2023',
    lib: ['es2023'],
    module: 'esnext',
    moduleResolution: 'bundler',
    types: ['@morten-olsen/nova-game/android'],
    strict: true,
    noUncheckedIndexedAccess: true,
    verbatimModuleSyntax: true,
    isolatedModules: true,
    skipLibCheck: true,
    allowJs: true,
    checkJs: false,
    noEmit: true,
  },
  include: ['bot'],
};

const agentsGuide = `# Nova Android Factory

This project contains an autonomous android program for Project: Nova. Your job is to improve the programs in \`bot/\`, then use the Nova CLI to test them in \`game.json\`.

## Start here

1. Read \`docs/RULEBOOK.md\` for the current rules and action API. Every number in it
   is a default; the game you are playing hands the real ones to your bot in the
   \`rules\` global.
2. Read \`docs/ANDROID-BUILDER-MANUAL.md\` for the recommended build-and-test workflow.
3. Read \`docs/CLI-GUIDE.md\` before running a simulation.
4. Inspect \`bot/starter-builder.ts\`; edit or replace it rather than changing installed packages.

## Androids are TypeScript

\`upload-script\`, \`host\` and \`join\` compile and bundle the file they are given
before it reaches the game, so an android is a normal TypeScript project rather
than one file that has to fit in one file:

- An android is a module whose default export is its turn function. It is called
  once per round and returns that round's action:

  \`\`\`ts
  import { chooseTarget } from './lib/targets.js';

  const turn: AndroidTurn = () => ({ type: 'android.move', direction: chooseTarget() });
  export default turn;
  \`\`\`

  That is the only accepted shape. A file ending in a bare action expression is
  refused, so that adding an import to a working android never changes how the
  file is read.
- Split an android across as many files as it needs; imports of your own modules
  are followed and bundled in.
- Types come from the game itself. \`world\`, \`androidId\`, \`rules\`, \`turn\` and
  \`finalTurn\` are globals, and \`Action\`, \`AndroidTurn\`, \`Tile\`, \`Rules\` and
  the rest are in scope without an import. Run \`npm run check\` to type-check
  without playing.
- Read numbers from \`rules\`, never from the rulebook. Cargo capacity, build
  costs, battery costs, hazard damage, sight ranges, what scores and the board's
  \`width\`/\`height\` are all in there, resolved for this game:

  \`\`\`ts
  const capacity = rules.android.cargoCapacity;
  const onMap = (p: Position) => p.x >= 0 && p.y >= 0 && p.x < rules.world.width && p.y < rules.world.height;
  \`\`\`

  A bot with the rulebook's numbers baked in is a bot that breaks the moment the
  game is tuned — and \`nova create-game --rules rules.json\` tunes it.
- Only import types from \`@morten-olsen/nova-game\`, never values: the package
  is the engine, and bundling it into an android would spend the whole turn
  budget on loading it.

The sandbox still has no module loader, no filesystem, no network and no timers.
Bundling happens here, before upload; nothing is imported at run time.

## Simulation loop

Run these commands from this directory:

\`\`\`sh
npx nova create-game --file game.json [--width 16 --height 16] [--rules rules.json]
npx nova upload-script --file game.json --owner player-1 --name <name> --script bot/<file>.ts
npx nova launch-android --file game.json --owner player-1 --script-id script-1
npx nova run --file game.json --rounds 10
npx nova status --file game.json
npx nova play --file game.json
\`\`\`

Each upload creates a new script id. Existing androids keep their old script, so launch a new android (when charger capacity permits) to test an uploaded version. Game files are recordings: do not hand-edit \`game.json\`; recreate it with \`npx nova create-game --file game.json\` when you want a clean run. Run \`npx nova update\` to update the pinned Nova packages and refresh \`docs/\`; it leaves your bots untouched.

## Playing another player

An Android can be matched against another player's Android over a peer-to-peer
connection. One side hosts and shares the invite code it prints:

\`\`\`sh
npx nova host --script bot/<file>.ts --rounds 20 --disclosure full
npx nova join <invite-code> --script bot/<file>.ts
\`\`\`

The host chooses the round count and the disclosure mode, which decides what
evidence both players keep afterwards:

- \`--disclosure full\` writes a replayable recording for both players, openable
  with \`npx nova play --file match.json\`. It preserves the world for rendering,
  but redacts the other player's script source, Android memory, and Android
  recording.
- \`--disclosure recording\` writes only what each player's own Android put in its
  \`recording\` field, plus the final scores. There is no replay to inspect.

Under \`recording\`, whatever the Android wrote down is the only account of the
match. An Android intended for competitive play should write to \`recording\`
deliberately: note what it saw, where it went, and why it changed plan. Note
that a rejected action is discarded whole, including its \`recording\` write, so
an Android that fails a turn records nothing for that round.

## Boundaries

- Return exactly one valid action object from the turn function; use the rulebook action names and fields.
- A turn reads the world from the \`androidId\`, \`world\`, \`rules\`, \`turn\` and \`finalTurn\` globals. It has no filesystem, no network and no timers, and nothing is imported while it runs.
- Do not hardcode a game constant. If a number describes the game, it is in \`rules\`; if it describes your strategy, name it in the bot.
- Treat the rulebook as the player contract. If it is unclear, inspect \`node_modules/@morten-olsen/nova-game/src/\` for the implemented behavior, then keep bot code independent of that package's internals.
- Make one behavioral change at a time and validate it with a fresh or understood recording.
`;

const readDirectoryName = async (): Promise<string> => {
  if (!stdin.isTTY) {
    throw new Error('A factory folder name is required outside an interactive terminal. Use: nova init <folder-name>');
  }

  const prompt = createInterface({ input: stdin, output: stdout });
  const directory = await prompt.question('Android factory folder name: ');
  prompt.close();
  return directory;
};

const validateDirectoryName = (directory: string): string => {
  const name = directory.trim();
  if (!name || name === '.' || name === '..' || isAbsolute(name) || name.includes('/') || name.includes('\\')) {
    throw new Error('Factory folder name must be one new folder name, without path separators.');
  }

  return name;
};

const copyDocs = async (factoryDirectory: string): Promise<void> => {
  const docsDirectory = join(factoryDirectory, 'docs');
  await mkdir(docsDirectory, { recursive: true });
  await Promise.all([
    cp(join(docsPackageDirectory, 'RULEBOOK.md'), join(docsDirectory, 'RULEBOOK.md')),
    cp(join(docsPackageDirectory, 'CLI-GUIDE.md'), join(docsDirectory, 'CLI-GUIDE.md')),
    cp(join(docsPackageDirectory, 'ANDROID-BUILDER-MANUAL.md'), join(docsDirectory, 'ANDROID-BUILDER-MANUAL.md')),
  ]);
};

const copyStarterBot = async (factoryDirectory: string): Promise<void> => {
  await mkdir(join(factoryDirectory, 'bot'), { recursive: true });
  await cp(
    join(docsPackageDirectory, 'examples', 'starter-builder.ts'),
    join(factoryDirectory, 'bot', 'starter-builder.ts'),
  );
};

const writeTsconfig = async (factoryDirectory: string): Promise<void> => {
  await writeFile(join(factoryDirectory, 'tsconfig.json'), `${JSON.stringify(tsconfigJson, null, 2)}\n`);
};

const installDependencies = async (factoryDirectory: string): Promise<void> => {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  await execFileAsync(npm, ['install'], { cwd: factoryDirectory });
};

const merged = (existing: unknown, additions: Record<string, string>): Record<string, string> => ({
  ...(typeof existing === 'object' && existing !== null ? (existing as Record<string, string>) : {}),
  ...additions,
});

const updatePackageDependencies = async (factoryDirectory: string): Promise<void> => {
  const packagePath = join(factoryDirectory, 'package.json');
  const packageData = JSON.parse(await readFile(packagePath, 'utf8')) as Record<string, unknown>;

  packageData.dependencies = merged(packageData.dependencies, novaDependencies);
  packageData.devDependencies = merged(packageData.devDependencies, factoryDevDependencies);
  await writeFile(packagePath, `${JSON.stringify(packageData, null, 2)}\n`);
};

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const createFactory = async (options: FactoryOptions): Promise<string> => {
  const name = validateDirectoryName(options.directory ?? (await readDirectoryName()));
  const factoryDirectory = resolve(process.cwd(), name);
  const currentDirectory = resolve(process.cwd());

  if (relative(currentDirectory, factoryDirectory).startsWith(`..${sep}`)) {
    throw new Error('Factory folder must be inside the current directory.');
  }

  try {
    await access(factoryDirectory);
    throw new Error(`Factory folder already exists: ${factoryDirectory}`);
  } catch (error: unknown) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
      throw error;
    }
  }

  await mkdir(factoryDirectory);
  await Promise.all([
    writeFile(join(factoryDirectory, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`),
    writeFile(join(factoryDirectory, '.gitignore'), 'node_modules/\n'),
    writeFile(join(factoryDirectory, 'AGENTS.md'), agentsGuide),
  ]);
  await Promise.all([copyDocs(factoryDirectory), copyStarterBot(factoryDirectory), writeTsconfig(factoryDirectory)]);
  await installDependencies(factoryDirectory);

  return factoryDirectory;
};

const updateFactory = async (): Promise<string> => {
  const factoryDirectory = process.cwd();
  await updatePackageDependencies(factoryDirectory);
  await copyDocs(factoryDirectory);
  // Written only when absent. A factory from before androids were TypeScript
  // needs one to type-check at all; one that already has a tsconfig may have
  // been tuned, and refreshing docs is not licence to overwrite that.
  if (!(await exists(join(factoryDirectory, 'tsconfig.json')))) {
    await writeTsconfig(factoryDirectory);
  }
  await installDependencies(factoryDirectory);
  return factoryDirectory;
};

export { createFactory, updateFactory };
