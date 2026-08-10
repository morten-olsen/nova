import { createMatchConnection, type MatchConnection } from '@morten-olsen/nova-match';
import Peer, { type DataConnection } from 'peerjs';

/**
 * The browser half of the match transport.
 *
 * Considerably shorter than the CLI's, and that asymmetry is the whole reason
 * cross-play works: `peerjs` is a browser library, so here it just runs. The
 * CLI needs `node-datachannel` polyfills and CommonJS interop to reach the same
 * signalling server. Both ends speak the identical protocol, so which side is a
 * terminal and which is a tab does not matter.
 */
const connectionFrom = (peer: Peer, connection: DataConnection): MatchConnection =>
  createMatchConnection({
    onData: (handler) => connection.on('data', (data) => handler(data)),
    onClose: (handler) => connection.on('close', () => handler()),
    onError: (handler) => connection.on('error', (error) => handler(error)),
    send: (message) => void connection.send(message),
    close: () => {
      connection.close();
      peer.destroy();
    },
  });

const openPeer = (peerId?: string): Promise<Peer> =>
  new Promise((resolve, reject) => {
    const peer = new Peer(peerId as string, { debug: 0 });
    peer.on('open', () => resolve(peer));
    peer.on('error', (error) => {
      const type = (error as { type?: string }).type ?? String(error);
      reject(
        type === 'unavailable-id'
          ? new Error('That invite code is already in use. Start the match again for a new code.')
          : new Error(`Unable to reach the matchmaking service: ${type}`),
      );
    });
  });

type MatchHost = {
  close: () => void;
  waitForGuest: () => Promise<MatchConnection>;
};

/**
 * Registers the invite code with the signalling server.
 *
 * Resolving before a guest arrives is the point: the code is only usable once
 * registration has happened, and the host has to display it before anyone can
 * join.
 */
const createMatchHost = async (peerId: string): Promise<MatchHost> => {
  const peer = await openPeer(peerId);

  return {
    close: () => peer.destroy(),
    waitForGuest: () =>
      new Promise<MatchConnection>((resolve, reject) => {
        peer.on('connection', (incoming) => {
          incoming.on('open', () => resolve(connectionFrom(peer, incoming)));
        });
        peer.on('error', (error) => reject(new Error(`Connection failed: ${String(error)}`)));
      }),
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
      const type = (error as { type?: string }).type ?? String(error);
      reject(
        type === 'peer-unavailable'
          ? new Error('No host is waiting on that invite code.')
          : new Error(`Unable to connect: ${type}`),
      );
    });
  });

  return connectionFrom(peer, connection);
};

export type { MatchHost };
export { createMatchHost, joinMatch };
