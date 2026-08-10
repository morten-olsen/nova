/*
 * The full barrel, deliberately. Importing the editor piecewise trims the
 * syntax definitions for languages we never use, but those are lazy chunks that
 * are only fetched when a language is actually opened — the main bundle moved
 * by ~2%. The piecewise TypeScript contribution also ships `export {}` as its
 * types, so `javascriptDefaults` below would have to be cast blind.
 */
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

import androidGlobals from './android-globals.d.txt?raw';
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
 * Scripts are plain JavaScript, but the JS language service still type-checks
 * against ambient declarations, so authors get completion on `world.androids`
 * and a red squiggle on a misspelled action without writing any TypeScript.
 */
const setupMonaco = (): typeof monaco => {
  if (installed) {
    return monaco;
  }
  installed = true;

  installWorkers();

  // `monaco.languages.typescript` is deprecated in 0.55 in favour of this
  // top-level namespace.
  const defaults = monaco.typescript.javascriptDefaults;
  defaults.setCompilerOptions({
    allowJs: true,
    checkJs: true,
    lib: ['es2023'],
    // Monaco's enum stops at ES2020 before jumping to ESNext; the sandbox is a
    // current browser, so the newer target is the accurate one.
    target: monaco.typescript.ScriptTarget.ESNext,
    noEmit: true,
  });
  defaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    // "Unreachable/unused expression" fires on the trailing `({ ... })` that
    // every script must end in — the contract's shape, not a mistake.
    diagnosticCodesToIgnore: [7028, 2695],
  });
  defaults.addExtraLib(androidGlobals, 'ts:nova/android-globals.d.ts');

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
    scriptModel = monacoApi.editor.createModel(value, 'javascript', monacoApi.Uri.parse('inmemory://nova/android.js'));
  }
  return scriptModel;
};

export { getScriptModel, setupMonaco };
