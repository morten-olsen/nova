import { toAndroidEvent } from '@morten-olsen/nova-game';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { isCompiledModule, wrapAndroidModule } from '../src/module/android-module.js';
import { createQuickJsScriptRunner } from '../src/runner/quickjs-script-runner.js';

/**
 * The path the browser lab takes: TypeScript compiles one file to CommonJS, and
 * the wrapper turns the module it produced into the single expression the
 * sandbox evaluates.
 *
 * Compiled here rather than hand-written, because both halves of this are claims
 * about the compiler's output — that a module is recognisable from it, and that
 * wrapping it produces something QuickJS will run. A fixture would only prove
 * the fixture.
 */
const compile = (source: string): string =>
  ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS },
  }).outputText;

const world = {
  scripts: [],
  tiles: [{ position: { x: 0, y: 0 }, composition: {} }],
  androids: [
    {
      id: 'android-1',
      ownerId: 'player-1',
      scriptId: 'script-1',
      position: { x: 0, y: 0 },
      battery: 100,
      health: 100,
      active: true,
      memory: '',
      recording: '',
    },
  ],
  buildings: [],
};

const run = async (content: string) => {
  const runner = createQuickJsScriptRunner();
  return runner.execute({ androidId: 'android-1', content, world });
};

describe('recognising a compiled module', () => {
  it('sees the module a top-level export produces', () => {
    expect(isCompiledModule(compile("const t = () => ({ type: 'android.wait' });\nexport default t;"))).toBe(true);
  });

  it('does not mistake a plain script for one', () => {
    expect(isCompiledModule(compile("const a = { type: 'android.wait' };\na;"))).toBe(false);
    expect(isCompiledModule(compile("type A = { type: string };\nconst a: A = { type: 'android.wait' };\na;"))).toBe(
      false,
    );
  });
});

describe('wrapping a compiled module', () => {
  it('runs the exported turn function and hands back what it returned', async () => {
    // Named `turn`, as the documentation writes it. The name matters: the
    // wrapper once declared a `turn` of its own beside the module's code, and
    // every android that followed the documentation failed to parse.
    const content = wrapAndroidModule(
      compile(`const turn = () => ({ type: 'android.move', direction: 'east' });
               export default turn;`),
    );

    await expect(run(content)).resolves.toEqual(
      toAndroidEvent({ androidId: 'android-1', result: { type: 'android.move', direction: 'east' } }),
    );
  });

  it('gives the turn function the sandbox globals', async () => {
    const content = wrapAndroidModule(
      compile(`declare const world: { androids: { id: string; battery: number }[] };
               declare const androidId: string;
               const turn = () => ({
                 type: 'android.wait',
                 recording: androidId + ' at ' + world.androids[0].battery,
               });
               export default turn;`),
    );

    await expect(run(content)).resolves.toMatchObject({ recording: 'android-1 at 100' });
  });

  it('explains a default export that is not a function', async () => {
    const content = wrapAndroidModule(compile("export default { type: 'android.wait' };"));

    await expect(run(content)).rejects.toThrowError(/must default-export the function that returns/);
  });

  it('keeps the module out of the global scope it is dropped into', async () => {
    // `module` and `exports` are the wrapper's own locals. A second script in the
    // same runtime must not be able to see either, or one android's compilation
    // artefacts would be another's globals.
    const content = wrapAndroidModule(
      compile(`const turn = () => ({
                 type: 'android.wait',
                 recording: typeof (globalThis as Record<string, unknown>).module + ' ' +
                   typeof (globalThis as Record<string, unknown>).exports,
               });
               export default turn;`),
    );

    await expect(run(content)).resolves.toMatchObject({ recording: 'undefined undefined' });
  });
});
