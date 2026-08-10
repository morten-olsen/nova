import { toAndroidEvent, type AndroidEvent, type ScriptExecuteOptions } from '@morten-olsen/nova-game';

import type { SandboxOutcome } from './quickjs-sandbox.js';

/**
 * Packs a turn's script globals into the single string the sandbox takes.
 *
 * `world` arrives already fogged by the loop, so it is serialized as-is.
 *
 * `turn` and `finalTurn` are lifted out of the world rather than left for the
 * script to dig for: a bot that wants to change tactics near the end should not
 * have to know that the engine calls them rounds, and `finalTurn` needs a
 * defined-but-undefined global so that reading it is a check rather than a
 * `ReferenceError`.
 */
const toSandboxInputJson = (options: Pick<ScriptExecuteOptions, 'androidId' | 'world'>): string =>
  JSON.stringify({
    androidId: options.androidId,
    world: options.world,
    turn: options.world.round ?? 0,
    finalTurn: options.world.finalRound,
  });

type FromOutcomeOptions = {
  androidId: string;
  outcome: SandboxOutcome;
};

/**
 * Host-side half of the sandbox boundary, shared by the in-process runner and
 * the Worker one so that a script rejected on one path is rejected identically
 * on the other.
 */
const toAndroidEventFromOutcome = (options: FromOutcomeOptions): AndroidEvent => {
  const { androidId, outcome } = options;

  if (!outcome.ok) {
    const error = new Error(outcome.message);
    if (outcome.stack !== undefined) {
      // The VM's stack, which points at lines in the bot rather than in this
      // package — the only stack worth showing a script author.
      error.stack = outcome.stack;
    }
    throw error;
  }

  // `undefined` here means the script's last expression had no JSON
  // representation; the engine's shared validator turns that into the
  // "must end in an action object" advice.
  const result: unknown = outcome.actionJson === undefined ? undefined : JSON.parse(outcome.actionJson);
  return toAndroidEvent({ androidId, result });
};

export { toAndroidEventFromOutcome, toSandboxInputJson };
