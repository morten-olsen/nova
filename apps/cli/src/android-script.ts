import { basename, relative } from 'node:path';

import { wrapAndroidModule } from '@morten-olsen/nova-script-runner';
import { build, formatMessages, type BuildOptions, type Message, type OutputFile } from 'esbuild';

const sharedOptions = {
  bundle: true,
  write: false,
  metafile: true,
  logLevel: 'silent',
  charset: 'utf8',
  legalComments: 'none',
  /**
   * Not `node`: the sandbox is neither Node nor a browser, and of the two this
   * is the one that refuses `node:fs` outright instead of quietly bundling a
   * shim for it.
   */
  platform: 'browser',
  /**
   * QuickJS-ng implements more than this, but an android that runs in the CLI
   * has to run identically in the browser lab, and the oldest engine either one
   * is expected to meet sets the floor.
   */
  target: 'es2022',
} as const satisfies BuildOptions;

const describePath = (scriptPath: string): string => relative(process.cwd(), scriptPath) || basename(scriptPath);

const hasMessages = (error: unknown): error is { errors: Message[] } =>
  typeof error === 'object' && error !== null && Array.isArray((error as { errors?: unknown }).errors);

/**
 * Re-throws an esbuild failure as the report it would have printed.
 *
 * Every entry point here is player code, so the location and the source excerpt
 * are the whole value of the message; an `Error` carrying only "Build failed
 * with 1 error" would send the player back to the compiler to find out where.
 */
const rethrowBuildFailure = async (error: unknown, scriptPath: string): Promise<never> => {
  if (!hasMessages(error)) {
    throw error;
  }

  const messages = await formatMessages(error.errors, { kind: 'error', color: false });
  throw new Error(`Could not build ${describePath(scriptPath)}:\n\n${messages.join('\n').trimEnd()}`);
};

const onlyOutput = (outputFiles: OutputFile[]): string => {
  const [file] = outputFiles;
  if (!file) {
    throw new Error('esbuild produced no output.');
  }

  return file.text;
};

/**
 * The entry's export names, read from a first pass over the bundle.
 *
 * Reported only for an ESM output — a CommonJS bundle has already turned them
 * into property assignments — and asked for separately rather than inferred from
 * the finished bundle, because "did this file export a turn function?" is the
 * one question worth answering before anything is uploaded. Unresolved imports
 * surface here too.
 */
const readEntryExports = async (scriptPath: string): Promise<string[]> => {
  const result = await build({ ...sharedOptions, entryPoints: [scriptPath], format: 'esm' });
  const output = Object.values(result.metafile.outputs)[0];
  if (!output) {
    throw new Error('esbuild produced no output.');
  }

  return output.exports;
};

/**
 * Bundles an android that spans more than one file into one CommonJS module,
 * and hands it to the sandbox as a single turn.
 *
 * CommonJS is the format that survives the trip: it needs nothing from the host
 * but a `module` object, which is exactly what {@link wrapAndroidModule}
 * provides — the same wrapper the browser lab uses on the single file it
 * compiles, so an android that runs in one runs identically in the other.
 */
const bundleModule = async (scriptPath: string): Promise<string> => {
  const result = await build({ ...sharedOptions, entryPoints: [scriptPath], format: 'cjs' });
  return wrapAndroidModule(onlyOutput(result.outputFiles));
};

const missingDefaultExport = (scriptPath: string, exports: string[]): Error =>
  new Error(
    `${describePath(scriptPath)} ${exports.length > 0 ? `exports ${exports.join(', ')} but nothing as default` : 'has no default export'}.\n\n` +
      'An android is a module whose default export is its turn function, called once per\n' +
      'round and returning that round’s action:\n\n' +
      "  const turn: AndroidTurn = () => ({ type: 'android.wait' });\n" +
      '  export default turn;\n\n' +
      'An older android ends in a bare action expression instead. To bring one forward, put\n' +
      'its body in a turn function, return where it used to end in an expression, and export\n' +
      'the function.',
  );

/**
 * Reads an android from disk as the single script the sandbox will evaluate.
 *
 * TypeScript and multi-file androids exist entirely on this side of the upload:
 * the sandbox has no module loader and never sees a type, so whatever the player
 * wrote is compiled and bundled here into one self-contained script.
 *
 * There is one shape, deliberately. An android that ends in a bare action
 * expression could be supported by not wrapping it — but then adding a single
 * import to a working file would change how the file is read, and the failure
 * would arrive as an android that waits every round rather than as an error. One
 * contract costs a `export default` and never does that.
 */
const loadAndroidScript = async (scriptPath: string): Promise<string> => {
  const exports = await readEntryExports(scriptPath).catch((error: unknown) => rethrowBuildFailure(error, scriptPath));

  if (!exports.includes('default')) {
    throw missingDefaultExport(scriptPath, exports);
  }

  return bundleModule(scriptPath).catch((error: unknown) => rethrowBuildFailure(error, scriptPath));
};

export { loadAndroidScript };
