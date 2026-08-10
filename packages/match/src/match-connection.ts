/**
 * A message channel between the two players.
 *
 * Deliberately tiny, and deliberately free of PeerJS: the CLI reaches WebRTC
 * through `node-datachannel` polyfills while the browser has it natively, and
 * neither difference should reach the match flow.
 */
type MatchConnection = {
  send: (message: unknown) => void;
  /** Resolves with the next message, or rejects if the peer goes away first. */
  receive: () => Promise<unknown>;
  close: () => void;
};

type ConnectionSource = {
  onData: (handler: (data: unknown) => void) => void;
  onClose: (handler: () => void) => void;
  onError: (handler: (error: unknown) => void) => void;
  send: (message: unknown) => void;
  close: () => void;
};

/**
 * Wraps a transport into a queue-backed reader.
 *
 * Messages are buffered as they arrive, so a caller busy running rounds does
 * not miss anything sent in the meantime — the host can be mid-simulation when
 * the guest's message lands.
 */
const createMatchConnection = (source: ConnectionSource): MatchConnection => {
  const buffered: unknown[] = [];
  let waiting: { resolve: (value: unknown) => void; reject: (error: Error) => void } | undefined;
  let failure: Error | undefined;

  const fail = (error: Error): void => {
    failure ??= error;
    if (waiting) {
      waiting.reject(failure);
      waiting = undefined;
    }
  };

  source.onData((data) => {
    if (waiting) {
      waiting.resolve(data);
      waiting = undefined;
      return;
    }
    buffered.push(data);
  });
  source.onClose(() => fail(new Error('The other player disconnected.')));
  source.onError((error) => fail(new Error(`Connection error: ${String(error)}`)));

  return {
    send: (message) => source.send(message),
    receive: () =>
      new Promise<unknown>((resolve, reject) => {
        const next = buffered.shift();
        if (next !== undefined) {
          resolve(next);
          return;
        }
        if (failure) {
          reject(failure);
          return;
        }
        waiting = { resolve, reject };
      }),
    close: () => source.close(),
  };
};

export type { ConnectionSource, MatchConnection };
export { createMatchConnection };
