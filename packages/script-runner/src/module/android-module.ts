/**
 * The prologue TypeScript puts at the top of every CommonJS module it emits, and
 * at the top of nothing else.
 *
 * Compiler output rather than author text, which is what makes it usable as a
 * signal: a file that produces this line had a top-level `export`, and a file
 * that did not is a plain script whose last expression is the turn's action.
 * The distinction cannot be recovered later — see {@link wrapAndroidModule}.
 */
const commonJsPrologue = 'Object.defineProperty(exports, "__esModule", { value: true });';

/**
 * Whether compiled output is a module rather than a bare script.
 *
 * Only for a host that compiles one file at a time and has nothing better to go
 * on. A bundler knows what it bundled and should say so from its own records
 * instead of reading its output back.
 */
const isCompiledModule = (code: string): boolean => code.includes(commonJsPrologue);

/**
 * Presents a compiled CommonJS module to the sandbox as one turn.
 *
 * The sandbox evaluates a script in the global scope and takes the value of its
 * final expression statement as the action for the round. A module cannot end in
 * an expression — it ends in an assignment to `exports` — so something has to
 * call the turn function it exported and leave the result behind as that final
 * expression. That is this.
 *
 * Note what the wrapper costs: everything inside it is a function body, so the
 * completion value of the code being wrapped is discarded. A plain script must
 * never be passed through here, because that discarded value is its whole
 * output.
 *
 * The module body gets a scope of its own, with `module` and `exports` as
 * parameters — the shape any CommonJS loader uses, and here it is load-bearing
 * rather than traditional. Declaring those alongside the module's own code would
 * put every name this wrapper uses in the same scope as every name the android
 * uses, and an android whose turn function is called `turn` is not an exotic
 * case: it is what the documentation tells people to write.
 *
 * Shared by the CLI, which bundles an android from many files, and by the
 * browser lab, which compiles one — so that an android behaves identically
 * whichever of the two ran it.
 */
const wrapAndroidModule = (code: string): string =>
  `(function () {
  "use strict";
  var __novaModule = { exports: {} };
  (function (module, exports) {
${code}
  })(__novaModule, __novaModule.exports);
  var __novaTurn = __novaModule.exports.default;
  if (typeof __novaTurn !== "function") {
    throw new Error("An android that exports anything must default-export the function that returns each turn's action.");
  }
  return __novaTurn();
})();
`;

export { isCompiledModule, wrapAndroidModule };
