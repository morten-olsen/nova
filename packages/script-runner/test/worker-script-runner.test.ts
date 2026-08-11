import type { World } from '@morten-olsen/nova-game';
import { describe, expect, it } from 'vitest';

import { loadQuickJs } from '../src/quickjs/quickjs-module.js';
import { runInSandbox } from '../src/runner/quickjs-sandbox.js';
import { createWorkerScriptRunner } from '../src/worker/worker-script-runner.js';
import type { ScriptWorkerRequest, ScriptWorkerResponse } from '../src/worker/worker-protocol.js';

const world: World = {
  scripts: [],
  tiles: [{ position: { x: 0, y: 0 }, composition: { metal: 4 } }],
  androids: [
    {
      id: 'android-1',
      ownerId: 'player-1',
      scriptId: 'script-1',
      position: { x: 0, y: 0 },
      battery: 100,
      health: 100,
      active: true,
      cargo: {},
    },
  ],
  buildings: [],
  round: 2,
};

type StubOptions = {
  /** Swallows requests instead of answering them, standing in for a wedged worker. */
  silent?: boolean;
};

/**
 * A Worker that runs the real sandbox on this thread.
 *
 * The host half of the runner — turn ids, watchdogs, replacing a worker that
 * stops answering — is the part with edge cases worth pinning, and none of it
 * cares whether the messages crossed a thread boundary. A browser is the only
 * place a real Worker exists, and that is exactly what this stub avoids needing.
 */
const createStubWorker = (options: StubOptions = {}) => {
  const listeners = new Map<string, Set<EventListener>>();
  let terminated = false;
  let terminations = 0;

  const emit = (type: string, event: unknown): void => {
    for (const listener of listeners.get(type) ?? []) {
      listener(event as Event);
    }
  };

  const worker = {
    addEventListener: (type: string, listener: EventListener) => {
      const existing = listeners.get(type) ?? new Set<EventListener>();
      existing.add(listener);
      listeners.set(type, existing);
    },
    removeEventListener: () => undefined,
    terminate: () => {
      terminated = true;
      terminations += 1;
    },
    postMessage: (request: ScriptWorkerRequest) => {
      if (options.silent || terminated) {
        return;
      }
      void loadQuickJs().then((module) => {
        const response: ScriptWorkerResponse = {
          type: 'result',
          id: request.id,
          outcome: runInSandbox(module, request),
        };
        emit('message', { data: response });
      });
    },
  };

  return {
    worker: worker as unknown as Worker,
    signalReady: () => emit('message', { data: { type: 'ready' } satisfies ScriptWorkerResponse }),
    fail: (message: string) => emit('error', new ErrorEvent('error', { message })),
    terminations: () => terminations,
  };
};

describe('the Worker runner', () => {
  it('runs a turn through the worker and validates the action on the host side', async () => {
    const stub = createStubWorker();
    const runner = createWorkerScriptRunner({ createWorker: () => stub.worker });

    await expect(
      runner.execute({ androidId: 'android-1', content: "({ type: 'android.wait' })", world }),
    ).resolves.toEqual({ type: 'android.wait', androidId: 'android-1' });
  });

  it('passes the turn globals through the message boundary', async () => {
    const stub = createStubWorker();
    const runner = createWorkerScriptRunner({ createWorker: () => stub.worker });

    await expect(
      runner.execute({ androidId: 'android-1', content: "({ type: 'android.wait', memory: String(turn) })", world }),
    ).resolves.toMatchObject({ memory: '2' });
  });

  it('rejects a malformed action rather than leaving the turn unsettled', async () => {
    const stub = createStubWorker();
    const runner = createWorkerScriptRunner({ createWorker: () => stub.worker });

    await expect(runner.execute({ androidId: 'android-1', content: '42', world })).rejects.toThrowError(
      /must produce an action object/,
    );
  });

  it('keeps turns apart when several are in flight', async () => {
    const stub = createStubWorker();
    const runner = createWorkerScriptRunner({ createWorker: () => stub.worker });

    const results = await Promise.all([
      runner.execute({ androidId: 'android-1', content: "({ type: 'android.wait', memory: 'a' })", world }),
      runner.execute({ androidId: 'android-1', content: "({ type: 'android.wait', memory: 'b' })", world }),
      runner.execute({ androidId: 'android-1', content: "({ type: 'android.wait', memory: 'c' })", world }),
    ]);

    expect(results.map((result) => ('memory' in result ? result.memory : undefined))).toEqual(['a', 'b', 'c']);
  });

  it('replaces a worker that stops answering, and keeps serving turns afterwards', async () => {
    const wedged = createStubWorker({ silent: true });
    const healthy = createStubWorker();
    let spawns = 0;
    const runner = createWorkerScriptRunner({
      limits: { timeoutMs: 50 },
      graceMs: 10,
      createWorker: () => {
        spawns += 1;
        return spawns === 1 ? wedged.worker : healthy.worker;
      },
    });

    await expect(
      runner.execute({ androidId: 'android-1', content: "({ type: 'android.wait' })", world }),
    ).rejects.toThrowError(/turn budget/);
    expect(wedged.terminations()).toBe(1);

    await expect(
      runner.execute({ androidId: 'android-1', content: "({ type: 'android.wait' })", world }),
    ).resolves.toMatchObject({ type: 'android.wait' });
  });

  it('fails the turns a crashed worker was holding', async () => {
    const stub = createStubWorker({ silent: true });
    const runner = createWorkerScriptRunner({ createWorker: () => stub.worker });

    const turn = runner.execute({ androidId: 'android-1', content: "({ type: 'android.wait' })", world });
    stub.fail('the worker exploded');

    await expect(turn).rejects.toThrowError(/the worker exploded/);
  });

  it('reports readiness once the worker has its interpreter', async () => {
    const stub = createStubWorker();
    const runner = createWorkerScriptRunner({ createWorker: () => stub.worker });

    let ready = false;
    void runner.ready().then(() => {
      ready = true;
    });
    expect(ready).toBe(false);

    stub.signalReady();
    await runner.ready();
    expect(ready).toBe(true);
  });

  it('fails in-flight turns when disposed', async () => {
    const stub = createStubWorker({ silent: true });
    const runner = createWorkerScriptRunner({ createWorker: () => stub.worker });

    const turn = runner.execute({ androidId: 'android-1', content: "({ type: 'android.wait' })", world });
    runner.dispose();

    await expect(turn).rejects.toThrowError(/disposed/);
    expect(stub.terminations()).toBe(1);
  });
});
