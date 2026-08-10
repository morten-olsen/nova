# @morten-olsen/nova-script-runner

The sandbox android scripts run in — QuickJS compiled to WebAssembly, driven identically from Node and from the browser.

It replaces the two sandboxes this repo used to carry: `node:vm` in the CLI and `eval`-in-a-Worker in the IDE. Those agreed on the script contract by convention and testing; this one agrees by being the same interpreter, down to which language features exist and where a runaway loop is cut off.

## Using it

In Node, or anywhere blocking the calling thread for a millisecond is fine:

```ts
import { createQuickJsScriptRunner } from '@morten-olsen/nova-script-runner';

const loop = new Loop({ ruleset, scriptRunner: createQuickJsScriptRunner() });
```

In a browser, where a script should not compete with the UI for the main thread:

```ts
import { createWorkerScriptRunner } from '@morten-olsen/nova-script-runner/worker';

// Constructing it spawns the worker, which starts loading the interpreter.
// Do this at boot, not at the first turn.
const scriptRunner = createWorkerScriptRunner();
```

Both take the same `limits`, and both are `ScriptRunner`s as far as the engine is concerned.

### Bundler requirements

The worker entry loads its interpreter through a dynamic import, so it must be built as a **module worker**. In Vite that means:

```ts
// vite.config.ts
export default defineConfig({
  worker: { format: 'es' },
});
```

Without it the build fails with `Invalid value "iife" for option "worker.format"`. Hosts that bundle their workers some other way can pass `createWorker` instead of relying on the default entry.

## Why it is fast

Instantiating the WebAssembly module is the only expensive step — single-digit milliseconds from Node's disk cache, a few hundred in a browser that has to fetch the `.wasm`. Everything after it is cheap, so the design is built around paying that cost exactly once:

- The module is cached process-wide and shared by every runner in it.
- `warmUpQuickJs()` (and constructing either runner) starts the load early, so it overlaps with app startup instead of delaying the first turn.
- The worker runner is long-lived. Turns are messages to a worker that is already warm.
- The world crosses into the interpreter as a JSON string and the action comes back as one, rather than being rebuilt property by property across the FFI boundary.

Measured by `pnpm bench` on a 400-tile map: 0.7ms for a whole turn's runtime and teardown, 1.5ms for a turn that actually runs the starter bot.

## Isolation and limits

Every turn builds a fresh QuickJS runtime and destroys it afterwards. That is what makes the limits in `ScriptLimits` per turn rather than per match: a script that spends its entire memory budget hands none of that debt to the next android, and the script contract's "cannot retain state between turns" rule holds by construction.

CPU is budgeted in interpreter ticks rather than milliseconds, so a script is interrupted at the same instruction regardless of how fast the machine is — two peers replaying a match agree on the result. A wall-clock deadline sits behind it as a backstop for work that burns time without burning operations.

This is an isolation boundary, not a security one. A script cannot reach the host, but nothing here is hardened against a determined attacker.
