import type { GameRecording } from '@morten-olsen/nova-game';
import { useCallback, useState } from 'react';

import { runSandbox, type SandboxResult } from '../sandbox/sandbox.ts';

type SandboxRun = {
  error: string | undefined;
  isRunning: boolean;
  onRun: (content: string) => void;
  /** Replaces whatever the board is showing, e.g. with a finished match. */
  showRecording: (recording: GameRecording) => void;
  recording: GameRecording | undefined;
  result: SandboxResult | undefined;
  /** Changes on every new recording, so the board can reset its scrubber. */
  runId: number;
};

type SandboxRunOptions = {
  rounds: number;
  size: number;
};

/** Owns the sandbox run and whatever recording the board is currently showing. */
const useSandboxRun = ({ rounds, size }: SandboxRunOptions): SandboxRun => {
  const [result, setResult] = useState<SandboxResult>();
  const [recording, setRecording] = useState<GameRecording>();
  const [error, setError] = useState<string>();
  const [isRunning, setIsRunning] = useState(false);
  const [runId, setRunId] = useState(0);

  const showRecording = useCallback((next: GameRecording) => {
    setRecording(next);
    // A match replay has no sandbox failure list of its own, and showing the
    // previous run's failures beside it would be simply wrong.
    setResult(undefined);
    setRunId((current) => current + 1);
  }, []);

  const onRun = useCallback(
    (content: string) => {
      void (async () => {
        setIsRunning(true);
        setError(undefined);
        try {
          const next = await runSandbox({ content, height: size, rounds, width: size });
          setResult(next);
          setRecording(next.recording);
          setRunId((current) => current + 1);
        } catch (caught) {
          // A throw here is the harness failing. A failing script becomes a
          // failed turn inside the recording instead, and shows in the console.
          setError(caught instanceof Error ? caught.message : String(caught));
        } finally {
          setIsRunning(false);
        }
      })();
    },
    [rounds, size],
  );

  return { error, isRunning, onRun, recording, result, runId, showRecording };
};

export type { SandboxRun };
export { useSandboxRun };
