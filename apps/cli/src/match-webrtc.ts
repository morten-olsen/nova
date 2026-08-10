import { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription } from 'node-datachannel/polyfill';
import WebSocket from 'ws';

/**
 * PeerJS is a browser library, and Node has neither WebRTC nor the DOM globals
 * it reaches for. Everything here exists to make `peerjs` run unmodified in the
 * CLI; import this module before importing `peerjs`.
 *
 * Three of the four shims are unremarkable (a WebRTC implementation, a
 * WebSocket for signalling, and enough of `window`/`document`/`navigator` for
 * `webrtc-adapter` to load). The fourth is not obvious and is the reason peer
 * matches work at all — see `patchAddIceCandidate`.
 */

type CandidateLike = {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
};

/**
 * PeerJS sends ICE candidates through the signalling server as plain JSON, so
 * they arrive as objects rather than `RTCIceCandidate` instances, with
 * `sdpMLineIndex` serialized as `null`. libdatachannel accepts such an object
 * without throwing and then quietly ignores the candidate, so ICE never
 * completes: signalling looks perfect, both peers exchange offer, answer and
 * every candidate, and the data channel simply never opens.
 *
 * Re-wrapping into a real `RTCIceCandidate` and restoring the defaults that
 * `null` erased is what makes the connection establish.
 */
const patchAddIceCandidate = (): void => {
  const original = RTCPeerConnection.prototype.addIceCandidate;

  RTCPeerConnection.prototype.addIceCandidate = function addIceCandidatePatched(
    this: RTCPeerConnection,
    candidate?: CandidateLike | null,
  ) {
    if (candidate && !(candidate instanceof RTCIceCandidate)) {
      const normalized = new RTCIceCandidate({
        candidate: candidate.candidate ?? '',
        sdpMid: candidate.sdpMid ?? '0',
        sdpMLineIndex: candidate.sdpMLineIndex ?? 0,
      });
      return original.call(this, normalized);
    }

    return original.call(this, candidate as RTCIceCandidate | undefined);
  } as typeof original;
};

let installed = false;

/** Installs the globals `peerjs` expects. Safe to call more than once. */
const installWebRtcGlobals = (): void => {
  if (installed) {
    return;
  }
  installed = true;

  const globals = globalThis as Record<string, unknown>;

  patchAddIceCandidate();

  globals.RTCPeerConnection ??= RTCPeerConnection;
  globals.RTCIceCandidate ??= RTCIceCandidate;
  globals.RTCSessionDescription ??= RTCSessionDescription;
  globals.WebSocket ??= WebSocket;

  // `webrtc-adapter` inspects the browser it is running in at import time. It
  // finds no known browser here and applies no shims, which is what we want,
  // but it still needs these to exist to get that far.
  globals.window ??= globalThis;
  globals.navigator ??= { userAgent: 'nova-cli' };
  globals.document ??= {
    createElement: () => ({}),
    addEventListener: () => undefined,
  };
};

export { installWebRtcGlobals };
