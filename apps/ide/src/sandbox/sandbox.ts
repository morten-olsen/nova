import { createBaseRuleset, Loop, type GameRecording } from '@morten-olsen/nova-game';

import { createWorkerScriptRunner } from '../runner/worker-script-runner.ts';

type SandboxOptions = {
  content: string;
  height: number;
  rounds: number;
  timeoutMs: number;
  width: number;
};

type SandboxResult = {
  /** Byte-identical in shape to what `nova run` writes, so it opens in the replay viewer. */
  recording: GameRecording;
  /** Turns the script lost to an error or a timeout, newest last. */
  failures: { round: number; message: string }[];
};

const ownerId = 'player-1';

/**
 * Plays one script against a fresh map and returns the recording.
 *
 * Single android by design: the point is a tight edit-run-inspect loop, and one
 * android makes every event on the timeline attributable to the line that
 * caused it.
 */
const runSandbox = async (options: SandboxOptions): Promise<SandboxResult> => {
  const { content, height, rounds, timeoutMs, width } = options;
  const ruleset = createBaseRuleset({ world: { width, height } });
  const loop = new Loop({ ruleset, scriptRunner: createWorkerScriptRunner({ timeoutMs }) });

  loop.applyEvents([
    { type: 'user.upload-android-script', ownerId, name: 'draft', content },
    { type: 'user.launch-android', ownerId, scriptId: 'script-1' },
  ]);

  for (let round = 0; round < rounds; round += 1) {
    await loop.run();
  }

  const recording: GameRecording = { version: 1, initialWorld: loop.initialWorld, events: loop.events };

  // Counted by walking the event stream rather than by position in the failure
  // list, so a script that survives round 1 and dies in round 4 reports round 4.
  let round = 0;
  const failures: SandboxResult['failures'] = [];
  for (const event of loop.events) {
    if (event.type === 'game.round-start') {
      round += 1;
    }
    if (event.type === 'game.android-failed-turn') {
      failures.push({ round, message: event.error.message });
    }
  }

  return { recording, failures };
};

export type { SandboxOptions, SandboxResult };
export { runSandbox };
