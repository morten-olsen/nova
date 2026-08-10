import type { World } from '../schemas/schemas.world.js';
import { androidEventSchema, type AndroidEvent } from '../events/events.android.js';

type ScriptExecuteOptions = {
  androidId: string;
  content: string;
  /**
   * Already fogged by {@link projectWorldForAndroid}. Runners expose this as the
   * `world` global verbatim; they must not be handed the unprojected world.
   */
  world: World;
};

/**
 * Runs one android's script for a single turn and resolves with the action it
 * chose.
 *
 * The engine deliberately ships no implementation: a sandbox needs an
 * interpreter, and the engine should not force one on every host that only
 * wants the rules. `@morten-olsen/nova-script-runner` is the implementation the
 * CLI and the IDE both use, and what any other host should reach for first.
 *
 * An implementation must evaluate `content` such that the value of its final
 * expression statement is the result, matching the documented script contract
 * in `docs/ANDROID-BUILDER-MANUAL.md`, then hand that value to
 * {@link toAndroidEvent}.
 */
type ScriptRunner = {
  execute: (options: ScriptExecuteOptions) => Promise<AndroidEvent>;
};

type ToAndroidEventOptions = {
  androidId: string;
  result: unknown;
};

/**
 * Validates a script's completion value and stamps it with the acting android.
 *
 * Shared by every {@link ScriptRunner} so that a script rejected by one sandbox
 * is rejected identically by the others.
 */
const toAndroidEvent = (options: ToAndroidEventOptions): AndroidEvent => {
  const { androidId, result } = options;
  if (typeof result !== 'object' || result === null) {
    const described = result === undefined ? 'undefined' : JSON.stringify(result);
    throw new Error(
      `Script for ${androidId} must end in an action object, but produced ${described}. ` +
        "Parenthesise the action so it is the final expression, e.g. ({ type: 'android.wait' });",
    );
  }
  return androidEventSchema.parse({ ...result, androidId });
};

export type { ScriptExecuteOptions, ScriptRunner };
export { toAndroidEvent };
