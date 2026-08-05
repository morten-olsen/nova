import { createContext, runInContext } from 'node:vm';

import { World } from '../schemas/schemas.world.js';
import { AndroidEvent, androidEventSchema } from '../events/events.android.js';

type ScriptExecuteOptions = {
  androidId: string;
  content: string;
  world: World;
};

type ScriptRunnerOptions = {
  timeoutMs?: number;
};

class ScriptRunner {
  #timeoutMs: number;

  constructor(options: ScriptRunnerOptions = {}) {
    this.#timeoutMs = options.timeoutMs ?? 1000;
  }

  public execute = (options: ScriptExecuteOptions) => {
    const { androidId, world, content } = options;
    const context = createContext({
      androidId,
      world: structuredClone(world),
    });
    const result = runInContext(content, context, {
      timeout: this.#timeoutMs,
    });
    const event: AndroidEvent = {
      ...result,
      androidId,
    };
    return androidEventSchema.parse(event);
  };
}

export { ScriptRunner };
