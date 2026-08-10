import type { AndroidEvent } from '@morten-olsen/nova-game';

type PendingTurn = {
  androidId: string;
  resolve: (event: AndroidEvent) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

type PendingTurns = {
  add: (id: number, turn: PendingTurn) => void;
  /** Removes a turn and stops its watchdog, or returns nothing if it already settled. */
  take: (id: number) => PendingTurn | undefined;
  /** Fails everything still waiting — the only honest thing to do when the worker goes away. */
  drain: (toError: (androidId: string) => Error) => void;
};

/**
 * The turns a Worker still owes answers for.
 *
 * Split out of the runner because settling a turn is the one thing that has to
 * happen exactly once: a turn can be finished by the worker's reply, by its own
 * watchdog, or by the worker being replaced underneath it, and every one of
 * those paths has to clear the same timer and forget the same entry.
 */
const createPendingTurns = (): PendingTurns => {
  const turns = new Map<number, PendingTurn>();

  const take = (id: number): PendingTurn | undefined => {
    const turn = turns.get(id);
    if (!turn) {
      return undefined;
    }
    turns.delete(id);
    clearTimeout(turn.timer);
    return turn;
  };

  return {
    add: (id, turn) => {
      turns.set(id, turn);
    },
    take,
    drain: (toError) => {
      for (const id of [...turns.keys()]) {
        const turn = take(id);
        turn?.reject(toError(turn.androidId));
      }
    },
  };
};

export type { PendingTurn, PendingTurns };
export { createPendingTurns };
