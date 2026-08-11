/*
 * The full barrel, deliberately. Importing the editor piecewise trims the
 * syntax definitions for languages we never use, but those are lazy chunks that
 * are only fetched when a language is actually opened — the main bundle moved
 * by ~2%. The piecewise TypeScript contribution also ships `export {}` as its
 * types, so `javascriptDefaults` below would have to be cast blind.
 */
import { isCompiledModule, wrapAndroidModule } from '@morten-olsen/nova-script-runner';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import { declarations } from 'virtual:nova-declarations';

import { androidCompilerOptions, declarationFileName } from './android-compiler-options.ts';
import { novaEditorTheme } from './monaco-theme.ts';

/**
 * Monaco ships its language services as separate workers. Vite bundles them via
 * `?worker`, which keeps everything local — the default loader pulls from a CDN
 * and would break the moment this ran offline.
 */
const installWorkers = (): void => {
  self.MonacoEnvironment = {
    getWorker: (_workerId, label) =>
      label === 'javascript' || label === 'typescript' ? new tsWorker() : new editorWorker(),
  };
};

let installed = false;

/**
 * Teaches Monaco the android script contract.
 *
 * The declarations are the engine's own, read off the installed package rather
 * than restated here, so completion on `world.androids` and a squiggle under a
 * misspelled action follow the game itself. A script written before any of this
 * still type-checks: it is JavaScript, and JavaScript is TypeScript.
 */
const setupMonaco = (): typeof monaco => {
  if (installed) {
    return monaco;
  }
  installed = true;

  installWorkers();

  // `monaco.languages.typescript` is deprecated in 0.55 in favour of this
  // top-level namespace.
  const defaults = monaco.typescript.typescriptDefaults;
  defaults.setCompilerOptions(androidCompilerOptions);
  defaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    // Nothing suppressed. These used to hide the "unused expression" report on
    // the trailing `({ ... })` an android had to end in; now that an android
    // ends in an export, that report is worth reading — it is what an android
    // written the old way looks like before it is run.
    diagnosticCodesToIgnore: [],
  });
  for (const declaration of declarations) {
    defaults.addExtraLib(declaration.content, declarationFileName(declaration.path));
  }

  monaco.editor.defineTheme('nova', novaEditorTheme);

  return monaco;
};

let scriptModel: monaco.editor.ITextModel | undefined;

/**
 * The single model every editor instance attaches to.
 *
 * One model outlives every mount, under a stable URI. Letting Monaco mint a
 * fresh `inmemory://model/N` per mount means disposing the old one, and a model
 * disposed while the TypeScript worker still has a request in flight throws
 * "Could not find source file" — which StrictMode reproduces on every reload.
 * Only ever one script is open, so one model is also the honest shape.
 */
const getScriptModel = (value: string): monaco.editor.ITextModel => {
  const monacoApi = setupMonaco();
  if (!scriptModel || scriptModel.isDisposed()) {
    scriptModel = monacoApi.editor.createModel(value, 'typescript', monacoApi.Uri.parse('inmemory://nova/android.ts'));
  }
  return scriptModel;
};

/**
 * Compiles what is in the editor down to the JavaScript the sandbox evaluates.
 *
 * Monaco already carries a TypeScript compiler in the language worker it uses
 * for completion and diagnostics, so asking that worker to emit costs nothing
 * beyond the round trip — and it compiles under exactly the options the squiggles
 * were computed with. A second compiler in the bundle could disagree with the
 * editor about the same file.
 *
 * The lab does not bundle — a script here is one file — so this only compiles,
 * and the CLI is where an android grows past one file. What comes out is wrapped
 * the same way either host wraps it, so the two agree on what running it means.
 *
 * Compiles through the open script model, so `source` must be what the editor is
 * showing — which is what every caller has, since the lab runs the draft. A
 * second model would be worse than it looks: a model that is not a module shares
 * the global scope with the others, and would report every top-level name in the
 * file as a redeclaration of itself.
 */
const compileScript = async (source: string): Promise<string> => {
  const monacoApi = setupMonaco();
  const model = getScriptModel(source);
  if (model.getValue() !== source) {
    model.setValue(source);
  }

  const getWorker = await monacoApi.typescript.getTypeScriptWorker();
  const client = await getWorker(model.uri);
  const emitted = await client.getEmitOutput(model.uri.toString());
  const output = emitted.outputFiles.find((file) => file.name.endsWith('.js'));
  if (!output) {
    throw new Error('The TypeScript compiler produced no JavaScript for this script.');
  }

  if (!isCompiledModule(output.text)) {
    throw new Error(
      'This android has no default export.\n\n' +
        'An android is a module whose default export is its turn function, called once per ' +
        "round and returning that round's action:\n\n" +
        "  const turn: AndroidTurn = () => ({ type: 'android.wait' });\n" +
        '  export default turn;\n\n' +
        'An older android ends in a bare action expression instead. To bring one forward, put ' +
        'its body in a turn function, return where it used to end in an expression, and export ' +
        'the function.',
    );
  }

  return wrapAndroidModule(output.text);
};

export { compileScript, getScriptModel, setupMonaco };
