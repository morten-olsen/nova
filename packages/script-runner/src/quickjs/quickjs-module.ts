import { newQuickJSWASMModuleFromVariant, type QuickJSWASMModule } from 'quickjs-emscripten-core';

/**
 * Fetching, compiling and instantiating the QuickJS WebAssembly module is the
 * only expensive part of running a script — a few milliseconds from Node's disk
 * cache, but a few hundred in a browser that has to fetch the `.wasm` first.
 * Everything downstream is sub-millisecond (`bench/turn-cost.ts`: 0.7ms for a
 * whole runtime, context and teardown), so the performance story of this
 * package is "pay for the module once, then never again".
 *
 * Hence a module-level promise rather than a per-runner one: two runners in the
 * same process (the IDE's sandbox and its match flow, say) share the single
 * instantiation. The promise is cached, not the resolved module, so concurrent
 * callers during the load queue behind one instantiation instead of racing into
 * several.
 */
let modulePromise: Promise<QuickJSWASMModule> | undefined;

/**
 * Imported dynamically rather than at the top of the file for two reasons: it
 * keeps the variant (and its `.wasm`) out of a bundler's entry chunk, so a host
 * that never runs a script never downloads an interpreter — and it is the shape
 * the library's own types ask for, since the variant package describes only its
 * CommonJS export and a static default import lands as a namespace object.
 */
const loadQuickJs = (): Promise<QuickJSWASMModule> => {
  modulePromise ??= newQuickJSWASMModuleFromVariant(import('@jitl/quickjs-ng-wasmfile-release-sync'));
  return modulePromise;
};

/**
 * Starts the module load without waiting for it.
 *
 * Call this as early as the host can — app boot, CLI startup — so the load
 * overlaps with work that was going to happen anyway and the first turn does
 * not pay for it. Safe to call repeatedly; only the first call does anything.
 */
const warmUpQuickJs = (): Promise<void> => loadQuickJs().then(() => undefined);

/**
 * Throws away the cached module so the next {@link loadQuickJs} builds a new
 * one.
 *
 * A WebAssembly module that has aborted stays aborted: every later call into it
 * fails, and since the module is shared, one wedged instance would end every
 * future turn in the process. The sandbox cannot always prevent that — a script
 * deep enough to blow the wasm stack takes the module down with it — so it
 * calls this instead, trading one lost turn and one reload for a runner that
 * keeps working.
 */
const resetQuickJs = (): void => {
  modulePromise = undefined;
};

export { loadQuickJs, resetQuickJs, warmUpQuickJs };
