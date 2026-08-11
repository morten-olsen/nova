import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import { androidCompilerOptions, declarationFileName } from '../src/editor/android-compiler-options.ts';
import { starterScript } from '../src/lab/starter-script.ts';
import { collectDeclarations } from '../vite/nova-declarations.ts';

/**
 * The lab types an android against the engine's own `.d.ts` files, served into
 * Monaco as extra libraries and resolved by the TypeScript compiler below —
 * so compiling the same files, under the same options, through a host that
 * behaves like Monaco's answers the question that matters without a browser.
 *
 * Worth the fidelity: the failure this guards against is silent. A bundle that
 * does not resolve, or options the worker reads differently than a tsconfig
 * would, do not throw. They widen `world` to `any`, and the lab quietly stops
 * reporting the mistakes it exists to report.
 */
const declarations = collectDeclarations();

const androidFile = declarationFileName('/android.ts');

/**
 * Monaco's `TypeScriptWorker`, as far as the compiler can tell: an empty working
 * directory, extra libraries looked up by exact name, and a standard library
 * resolved by name from the compiler's own `lib` folder — including the
 * "libized" fallback the worker applies before giving up on a name.
 */
const monacoLikeHost = (files: Map<string, string>): ts.CompilerHost => {
  const libDirectory = ts.getDirectoryPath(ts.sys.getExecutingFilePath());
  const readLib = (name: string): string | undefined => ts.sys.readFile(`${libDirectory}/${name}`);
  const getText = (fileName: string): string | undefined =>
    files.get(fileName) ?? readLib(fileName) ?? readLib(`lib.${fileName}.d.ts`);

  return {
    fileExists: (fileName) => getText(fileName) !== undefined,
    readFile: getText,
    getSourceFile: (fileName, languageVersion) => {
      const content = getText(fileName);
      return content === undefined ? undefined : ts.createSourceFile(fileName, content, languageVersion, true);
    },
    getDefaultLibFileName: () => 'lib.esnext.full.d.ts',
    writeFile: () => undefined,
    getCurrentDirectory: () => '',
    getCanonicalFileName: (fileName) => fileName,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
  };
};

const check = (source: string): string[] => {
  const files = new Map(
    declarations.map((declaration) => [declarationFileName(declaration.path), declaration.content]),
  );
  files.set(androidFile, source);

  const program = ts.createProgram([...files.keys()], androidCompilerOptions, monacoLikeHost(files));
  return ts
    .getPreEmitDiagnostics(program)
    .filter((diagnostic) => diagnostic.file?.fileName === androidFile)
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '));
};

describe('editor declarations', () => {
  it('ships the engine and the types it is inferred from', () => {
    expect(declarations.some((one) => one.path.endsWith('/android.d.ts'))).toBe(true);
    expect(declarations.some((one) => one.path === '/node_modules/zod/index.d.ts')).toBe(true);
  });

  it('loads a standard library', () => {
    // The canary. `lib: ['es2023']` reads as a file name here and matches
    // nothing, leaving the editor with no `Map`, no `Record` — and therefore no
    // working engine types either.
    expect(check('const seen = new Map<string, number>();\nseen;')).toEqual([]);
    expect(check('const counts: Record<string, number> = {};\ncounts;')).toEqual([]);
  });

  it('types the sandbox globals', () => {
    expect(check('const battery = world.androids[0]?.battery;\nbattery;')).toEqual([]);
    expect(check('const id: string = androidId;\nid;')).toEqual([]);
    expect(check('const capacity: number = rules.android.cargoCapacity;\ncapacity;')).toEqual([]);
    expect(check('const cost = rules.buildings.depot.cost.metal;\ncost;')).toEqual([]);
  });

  it('resolves the rules type rather than widening it to any', () => {
    // The rules are the whole reason a bot can stop hardcoding the rulebook, so
    // a `rules` that quietly types as `any` would be worse than no rules at all.
    expect(check('const width: string = rules.world.width;\nwidth;')[0]).toContain(
      "Type 'number' is not assignable to type 'string'.",
    );
    expect(check('const nothing = rules.android.cargoCapicity;\nnothing;')[0]).toContain('cargoCapicity');
  });

  it('holds a script to what the fog can hand it', () => {
    // The lab and the scaffolded factory type an android the same way, so that
    // moving a working script into `bot/` is not where its first error appears.
    expect(check('const battery = world.androids[0].battery;\nbattery;')[0]).toContain('possibly');
  });

  it('resolves the world type rather than widening it to any', () => {
    expect(check('const round: string = world.round;\nround;')[0]).toContain(
      "Type 'number | undefined' is not assignable to type 'string'.",
    );
  });

  it('rejects an action the engine would refuse', () => {
    expect(check("const action: Action = { type: 'android.teleport' };\naction;")).not.toEqual([]);
    expect(check("const action: Action = { type: 'android.move', direction: 'east' };\naction;")).toEqual([]);
  });

  it('types a turn function written for the bundler', () => {
    // Not named `turn`: that is one of the five globals, and a single-file
    // android is a script, so a top-level `const turn` redeclares it.
    expect(check("const strategy: AndroidTurn = () => ({ type: 'android.wait' });\nstrategy;")).toEqual([]);
  });

  it('reports nothing on the script the lab opens with', () => {
    // The first thing anyone sees. A red squiggle in it would read as the lab
    // being broken, and every one of these types is inferred from the engine, so
    // this is also where a change to the game shows up as a lie in the editor.
    expect(check(starterScript)).toEqual([]);
  });

  it('keeps the browser out of the sandbox', () => {
    expect(check("console.log('hi');")[0]).toContain("Cannot find name 'console'");
  });
});

describe('editor compiler options', () => {
  it('uses the values the compiler enums define', () => {
    expect(androidCompilerOptions.target).toBe(ts.ScriptTarget.ESNext);
    expect(androidCompilerOptions.module).toBe(ts.ModuleKind.CommonJS);
    expect(androidCompilerOptions.moduleResolution).toBe(ts.ModuleResolutionKind.Node10);
  });
});
