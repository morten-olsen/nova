import { installWebRtcGlobals } from './match-webrtc.js';

/**
 * A message channel between the two players, with the PeerJS and WebRTC detail
 * kept out of the match logic. Only this module imports `peerjs`.
 */
type MatchConnection = {
  send: (message: unknown) => void;
  /** Resolves with the next message, or rejects if the peer goes away first. */
  receive: () => Promise<unknown>;
  close: () => void;
};

type PeerLike = {
  on: (event: string, handler: (payload?: unknown) => void) => void;
  connect: (id: string, options?: unknown) => DataConnectionLike;
  destroy: () => void;
};

type DataConnectionLike = {
  on: (event: string, handler: (payload?: unknown) => void) => void;
  send: (data: unknown) => void;
  close: () => void;
};

type PeerConstructor = new (id?: string, options?: unknown) => PeerLike;

const loadPeerConstructor = async (): Promise<PeerConstructor> => {
  installWebRtcGlobals();

  // peerjs ships a CommonJS bundle whose named exports land on `default` when
  // imported from ESM.
  const imported = (await import('peerjs')) as unknown as {
    default?: { Peer?: PeerConstructor };
    Peer?: PeerConstructor;
  };
  const Peer = imported.default?.Peer ?? imported.Peer;

  if (typeof Peer !== 'function') {
    throw new Error('Unable to load peerjs. Reinstall Nova and try again.');
  }

  return Peer;
};

/**
 * Wraps a PeerJS data connection into a queue-backed reader. Messages are
 * buffered as they arrive, so a caller that is busy running rounds does not
 * miss anything sent in the meantime.
 */
const createConnection = (peer: PeerLike, connection: DataConnectionLike): MatchConnection => {
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

  connection.on('data', (data) => {
    if (waiting) {
      waiting.resolve(data);
      waiting = undefined;
      return;
    }
    buffered.push(data);
  });
  connection.on('close', () => fail(new Error('The other player disconnected.')));
  connection.on('error', (error) => fail(new Error(`Connection error: ${String(error)}`)));

  return {
    send: (message) => connection.send(message),
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
    close: () => {
      connection.close();
      peer.destroy();
    },
  };
};

const openPeer = async (peerId?: string): Promise<PeerLike> => {
  const Peer = await loadPeerConstructor();
  const peer = new Peer(peerId, { debug: 0 });

  await new Promise<void>((resolve, reject) => {
    peer.on('open', () => resolve());
    peer.on('error', (error) => {
      const message = String((error as { type?: string } | undefined)?.type ?? error);
      reject(
        message === 'unavailable-id'
          ? new Error('That invite code is already in use. Start the match again for a new code.')
          : new Error(`Unable to reach the matchmaking service: ${message}`),
      );
    });
  });

  return peer;
};

type MatchHost = {
  waitForGuest: () => Promise<MatchConnection>;
  close: () => void;
};

/**
 * Registers the invite code with the signalling server. Resolving before a
 * guest arrives is the point: the caller can print the code, which is only
 * usable once registration has happened, and then wait.
 */
const createMatchHost = async (peerId: string): Promise<MatchHost> => {
  const peer = await openPeer(peerId);

  return {
    waitForGuest: async () => {
      const connection = await new Promise<DataConnectionLike>((resolve, reject) => {
        peer.on('connection', (incoming) => {
          const dataConnection = incoming as DataConnectionLike;
          dataConnection.on('open', () => resolve(dataConnection));
        });
        peer.on('error', (error) => reject(new Error(`Connection failed: ${String(error)}`)));
      });

      return createConnection(peer, connection);
    },
    close: () => peer.destroy(),
  };
};

const joinTimeoutMs = 30_000;

/** Connects to a host's invite code. */
const joinMatch = async (peerId: string): Promise<MatchConnection> => {
  const peer = await openPeer();
  const connection = peer.connect(peerId, { reliable: true });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('No host answered that invite code. Check the code, and that the host is still waiting.'));
    }, joinTimeoutMs);

    connection.on('open', () => {
      clearTimeout(timeout);
      resolve();
    });
    peer.on('error', (error) => {
      clearTimeout(timeout);
      const message = String((error as { type?: string } | undefined)?.type ?? error);
      reject(
        message === 'peer-unavailable'
          ? new Error('No host is waiting on that invite code.')
          : new Error(`Unable to connect: ${message}`),
      );
    });
  });

  return createConnection(peer, connection);
};

export type { MatchConnection, MatchHost };
export { createMatchHost, joinMatch };
