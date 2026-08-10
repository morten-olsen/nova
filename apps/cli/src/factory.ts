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

const packageJson = {
  name: 'nova-android-factory',
  version: '0.1.0',
  private: true,
  type: 'module',
  engines: { node: '>=24' },
  scripts: {
    status: 'nova status --file game.json',
    simulate: 'nova run --file game.json --rounds 10',
    play: 'nova play --file game.json',
    host: 'nova host --script bot/starter-builder.js --rounds 20',
  },
  dependencies: novaDependencies,
};

const agentsGuide = `# Nova Android Factory

This project contains an autonomous android program for Project: Nova. Your job is to improve the programs in \`bot/\`, then use the Nova CLI to test them in \`game.json\`.

## Start here

1. Read \`docs/RULEBOOK.md\` for the current rules and action API.
2. Read \`docs/ANDROID-BUILDER-MANUAL.md\` for the recommended build-and-test workflow.
3. Read \`docs/CLI-GUIDE.md\` before running a simulation.
4. Inspect \`bot/starter-builder.js\`; edit or replace it rather than changing installed packages.

## Simulation loop

Run these commands from this directory:

\`\`\`sh
npx nova upload-script --file game.json --owner player-1 --name <name> --script bot/<file>.js
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
npx nova host --script bot/<file>.js --rounds 20 --disclosure full
npx nova join <invite-code> --script bot/<file>.js
\`\`\`

The host chooses the round count and the disclosure mode, which decides what
evidence both players keep afterwards:

- \`--disclosure full\` writes the complete recording for both players, openable
  with \`npx nova play --file match.json\`.
- \`--disclosure recording\` writes only what each player's own Android put in its
  \`recording\` field, plus the final scores. There is no replay to inspect.

Under \`recording\`, whatever the Android wrote down is the only account of the
match. An Android intended for competitive play should write to \`recording\`
deliberately: note what it saw, where it went, and why it changed plan. Note
that a rejected action is discarded whole, including its \`recording\` write, so
an Android that fails a turn records nothing for that round.

## Boundaries

- Return exactly one valid action object from each script turn; use the rulebook action names and fields.
- Scripts run in a sandbox with only \`androidId\` and \`world\` globals. Do not use imports, filesystem access, network access, or timers.
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
    join(docsPackageDirectory, 'examples', 'starter-builder.js'),
    join(factoryDirectory, 'bot', 'starter-builder.js'),
  );
};

const installDependencies = async (factoryDirectory: string): Promise<void> => {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  await execFileAsync(npm, ['install'], { cwd: factoryDirectory });
};

const updatePackageDependencies = async (factoryDirectory: string): Promise<void> => {
  const packagePath = join(factoryDirectory, 'package.json');
  const packageData = JSON.parse(await readFile(packagePath, 'utf8')) as Record<string, unknown>;
  const dependencies = packageData.dependencies;

  packageData.dependencies = {
    ...(typeof dependencies === 'object' && dependencies !== null ? dependencies : {}),
    ...novaDependencies,
  };
  await writeFile(packagePath, `${JSON.stringify(packageData, null, 2)}\n`);
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
  await Promise.all([copyDocs(factoryDirectory), copyStarterBot(factoryDirectory)]);
  await installDependencies(factoryDirectory);

  return factoryDirectory;
};

const updateFactory = async (): Promise<string> => {
  const factoryDirectory = process.cwd();
  await updatePackageDependencies(factoryDirectory);
  await copyDocs(factoryDirectory);
  await installDependencies(factoryDirectory);
  return factoryDirectory;
};

export { createFactory, updateFactory };
