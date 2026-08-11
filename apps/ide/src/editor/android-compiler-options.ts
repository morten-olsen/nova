import type * as monaco from 'monaco-editor';

/**
 * Where the engine's declarations are mounted in the language worker's file
 * system.
 *
 * A path layout rather than Monaco's flat `ts:` scheme: the declarations import
 * each other by relative path, and only a real node_modules tree lets TypeScript
 * walk between them.
 */
const declarationRoot = 'file:///';

const declarationFileName = (path: string): string => `${declarationRoot}${path.replace(/^\//, '')}`;

/**
 * How an android is compiled in the lab — for diagnostics, for completion, and
 * for the emit that produces what actually runs.
 *
 * `lib` has to name files rather than language versions. These options reach the
 * compiler already parsed, so nothing turns `es2023` into `lib.es2023.d.ts` on
 * the way in, and an unrecognised entry does not fall back to a default: it
 * loads no standard library at all. That failure is badly disguised. It does not
 * look like a missing `Array`, it looks like the game's types being broken —
 * `world` widens to `any` and a misspelled action stops being an error — because
 * every type the engine infers from Zod is built out of `Record` and `Omit`.
 *
 * The list stops at the language on purpose. The sandbox has no DOM, no
 * `console` and no timers, so a bot reaching for one should hear it here.
 */
const androidCompilerOptions = {
  // ScriptTarget.ESNext. Written as its value because this object is shared with
  // the tests, which check it against the compiler's own enums rather than
  // pulling the editor into a test run.
  target: 99,
  // ModuleKind.CommonJS. The lab does not bundle, so what it needs from the
  // compiler is a module that runs with nothing but a `module` object handed to
  // it — which is what `wrapAndroidModule` provides.
  module: 1,
  // ModuleResolutionKind.NodeJs, which is Node10 in current TypeScript, and all
  // Monaco's enum offers.
  moduleResolution: 2,
  lib: ['lib.es2023.d.ts'],
  baseUrl: declarationRoot,
  // The two bare specifiers the declarations import. Without these, resolution
  // would go looking for package.json files that are not served.
  paths: {
    '@morten-olsen/nova-game': ['node_modules/@morten-olsen/nova-game/dist/nova-game.d.ts'],
    zod: ['node_modules/zod/index.d.ts'],
  },
  allowJs: true,
  checkJs: true,
  // The same two the scaffolded factory sets, so that the lab and `nova
  // upload-script` agree about a script rather than the CLI being the strict
  // one. Both earn their place here: a missing android and an absent tile are
  // what a fogged world hands a bot, and both fail a turn when assumed away.
  strict: true,
  noUncheckedIndexedAccess: true,
  // Emit is how the Run button turns TypeScript into the JavaScript the sandbox
  // evaluates, so it cannot be switched off.
  noEmit: false,
  // Overrides the `strict` above, and deliberately. A script written before the
  // lab understood TypeScript is still a valid script, and reporting every
  // unannotated parameter in one would be a wall of red over code that runs.
  noImplicitAny: false,
} satisfies monaco.typescript.CompilerOptions;

export { androidCompilerOptions, declarationFileName, declarationRoot };
