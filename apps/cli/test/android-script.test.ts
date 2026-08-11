import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { createBaseRuleset, Loop, type Event } from '@morten-olsen/nova-game';
import { createQuickJsScriptRunner } from '@morten-olsen/nova-script-runner';
import { beforeAll, describe, expect, it } from 'vitest';

import { loadAndroidScript } from '../src/android-script.js';

let directory: string;

const write = async (name: string, content: string): Promise<string> => {
  const path = join(directory, name);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
  return path;
};

/**
 * Runs a loaded android for one round and reports the action it produced.
 *
 * The bundler's whole contract is "the sandbox can evaluate this", and only the
 * sandbox can answer that: a bundle that swallows its turn's value or leaves an
 * `import` behind type-checks perfectly and fails on the first round.
 */
const firstAction = async (content: string): Promise<Event> => {
  const loop = new Loop({
    ruleset: createBaseRuleset({ world: { width: 6, height: 6 } }),
    scriptRunner: createQuickJsScriptRunner(),
  });

  loop.applyEvents([{ type: 'user.upload-android-script', ownerId: 'player-1', name: 'test', content }]);
  loop.applyEvents([{ type: 'user.launch-android', ownerId: 'player-1', scriptId: 'script-1' }]);
  const before = loop.events.length;
  await loop.run();

  const action = loop.events.slice(before).find((event) => event.type.startsWith('android.'));
  if (!action) {
    throw new Error(`No android action was produced. Events: ${JSON.stringify(loop.events.slice(before))}`);
  }

  return action;
};

/** The messages of any turns the sandbox refused, for scripts expected to fail. */
const failedTurns = async (content: string): Promise<string[]> => {
  const loop = new Loop({
    ruleset: createBaseRuleset({ world: { width: 6, height: 6 } }),
    scriptRunner: createQuickJsScriptRunner(),
  });

  loop.applyEvents([{ type: 'user.upload-android-script', ownerId: 'player-1', name: 'test', content }]);
  loop.applyEvents([{ type: 'user.launch-android', ownerId: 'player-1', scriptId: 'script-1' }]);
  await loop.run();

  return loop.events.filter((event) => event.type === 'game.android-failed-turn').map((event) => event.error.message);
};

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'nova-android-script-'));
});

describe('loading an android', () => {
  it('bundles a typescript entry and its imports into one runnable script', async () => {
    await write(
      'lib/moves.ts',
      `const direction = (): 'east' => 'east';
       export { direction };`,
    );
    const entry = await write(
      'fleet.ts',
      `import { direction } from './lib/moves.js';

       type Action = { type: 'android.move'; direction: 'east' };

       const turn = (): Action => ({ type: 'android.move', direction: direction() });
       export default turn;`,
    );

    const content = await loadAndroidScript(entry);

    expect(content).not.toContain('import');
    expect(await firstAction(content)).toMatchObject({ type: 'android.move', direction: 'east' });
  });

  it('runs a single-file android with no imports', async () => {
    const entry = await write('lone.ts', "export default () => ({ type: 'android.wait' } as const);");

    expect(await firstAction(await loadAndroidScript(entry))).toMatchObject({ type: 'android.wait' });
  });

  it('reaches the script globals from an imported module', async () => {
    await write(
      'lib/self.ts',
      `const battery = (): number => world.androids.find((android) => android.id === androidId)?.battery ?? 0;
       export { battery };`,
    );
    const entry = await write(
      'reporter.ts',
      `import { battery } from './lib/self.js';

       declare const world: { androids: { id: string; battery: number }[] };
       declare const androidId: string;

       export default () => ({ type: 'android.wait', recording: 'battery ' + battery() });`,
    );

    expect(await firstAction(await loadAndroidScript(entry))).toMatchObject({
      type: 'android.wait',
      recording: 'battery 100',
    });
  });

  it('refuses an android that ends in a bare action expression', async () => {
    // The contract before androids were compiled. Bundling one would discard the
    // expression it ends in and leave the sandbox with nothing, so it is turned
    // away here with the change that brings it forward.
    const entry = await write('legacy.js', "(() => ({ type: 'android.wait' }))();");

    await expect(loadAndroidScript(entry)).rejects.toThrow(/has no default export[\s\S]*export default turn/);
  });

  it('refuses an entry that exports something other than a default', async () => {
    const entry = await write('named.ts', "export const turn = () => ({ type: 'android.wait' });");

    await expect(loadAndroidScript(entry)).rejects.toThrow(/exports turn but nothing as default/);
  });

  it('explains a default export that is not a function', async () => {
    // Exporting the action rather than a function that returns one. Nothing can
    // catch this before the round — `export default` accepts any value — so the
    // wrapper says what is wrong instead of failing the turn over a `world` that
    // was never read.
    const entry = await write('value.ts', "export default { type: 'android.wait' };");

    const failures = await failedTurns(await loadAndroidScript(entry));

    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain('must default-export the function that returns');
  });

  it('reports where a syntax error is instead of that the build failed', async () => {
    const entry = await write('broken.ts', 'const turn = () => {');

    await expect(loadAndroidScript(entry)).rejects.toThrow(/broken\.ts/);
  });

  it('refuses to resolve an import that does not exist', async () => {
    const entry = await write('missing.ts', "import { nothing } from './nowhere.js';\nexport default () => nothing;");

    await expect(loadAndroidScript(entry)).rejects.toThrow(/Could not build/);
  });
});
