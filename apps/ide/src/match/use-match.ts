import { useCallback, useRef, useState } from 'react';

import {
  startHosting,
  startJoining,
  type FlowHandlers,
  type HostFlowOptions,
  type JoinFlowOptions,
} from './match-flows.ts';
import type { MatchState } from './match-state.ts';

type UseMatch = MatchState & {
  accept: () => void;
  cancel: () => void;
  decline: () => void;
  host: (options: HostFlowOptions) => void;
  join: (options: JoinFlowOptions) => void;
};

const parseProgress = (message: string): { round: number; rounds: number } | undefined => {
  const match = /^Round (\d+)\/(\d+)$/.exec(message);
  return match ? { round: Number(match[1]), rounds: Number(match[2]) } : undefined;
};

/**
 * Drives a peer match from the browser, in either role.
 *
 * Both roles run the same flows from `@morten-olsen/nova-match` that the CLI
 * runs, over the same signalling server — so a tab can host for a terminal and
 * a terminal can host for a tab without either knowing the difference.
 */
const useMatch = (): UseMatch => {
  const [state, setState] = useState<MatchState>({ phase: 'idle' });
  /** Resolves the pending offer confirmation when the player answers. */
  const decision = useRef<(accepted: boolean) => void>(null);
  const teardown = useRef<() => void>(null);

  const patch = useCallback((next: Partial<MatchState>) => setState((current) => ({ ...current, ...next })), []);

  const handlers = useCallback(
    (): FlowHandlers => ({
      onCode: (code) => patch({ phase: 'waiting', code, status: 'Waiting for a player to join…' }),
      onDone: (result) => patch({ phase: 'done', offer: undefined, result }),
      onOffer: (offer) =>
        new Promise<boolean>((resolve) => {
          // Hands the decision to the UI. Nothing is sent until the player
          // answers, so declining costs them nothing.
          decision.current = resolve;
          patch({ phase: 'offered', offer });
        }),
      onReport: (message) => {
        const progress = parseProgress(message);
        patch(progress ? { progress, phase: 'playing' } : { status: message });
      },
      onTeardown: (close) => {
        teardown.current = close;
      },
    }),
    [patch],
  );

  const fail = useCallback(
    (error: unknown) => patch({ phase: 'error', error: error instanceof Error ? error.message : String(error) }),
    [patch],
  );

  const cancel = useCallback(() => {
    teardown.current?.();
    teardown.current = null;
    decision.current?.(false);
    decision.current = null;
    setState({ phase: 'idle' });
  }, []);

  const host = useCallback(
    (options: HostFlowOptions) => {
      setState({ phase: 'connecting', status: 'Reserving an invite code…' });
      startHosting(options, handlers())
        .then(() => {
          teardown.current = null;
        })
        .catch(fail);
    },
    [fail, handlers],
  );

  const join = useCallback(
    (options: JoinFlowOptions) => {
      setState({ phase: 'connecting', status: 'Connecting to the host…' });
      startJoining(options, handlers())
        .then(() => {
          teardown.current = null;
        })
        .catch(fail);
    },
    [fail, handlers],
  );

  const answer = useCallback(
    (accepted: boolean) => {
      decision.current?.(accepted);
      decision.current = null;
      if (accepted) {
        patch({ phase: 'playing', offer: undefined, status: 'Waiting for the host to run the match…' });
      }
    },
    [patch],
  );

  return { ...state, accept: () => answer(true), cancel, decline: () => answer(false), host, join };
};

export type { UseMatch };
export { useMatch };
