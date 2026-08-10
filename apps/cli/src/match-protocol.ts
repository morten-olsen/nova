import { randomBytes } from 'node:crypto';

import { worldSchema, eventSchema } from '@morten-olsen/nova-game';
import { z } from 'zod';

/**
 * How the match is disclosed to both players when it ends.
 *
 * `full` hands both sides a replayable `game.json`-shaped recording. It keeps
 * the complete world for rendering, but replaces the opponent's script source,
 * Android memory, and Android recording with `[Redacted]`.
 *
 * `recording` hands each side only what their own Android wrote to its
 * `recording` field during play, plus the final scores. Nothing about how the
 * opponent achieved their score is disclosed, so what an Android chooses to
 * write down becomes the player's only evidence for the next revision.
 */
const disclosureSchema = z.enum(['full', 'recording']);

type Disclosure = z.infer<typeof disclosureSchema>;

/** Bumped whenever the message shapes below stop being compatible. */
const protocolVersion = 1;

const hostPlayerId = 'player-1';
const guestPlayerId = 'player-2';

const gameFileSchema = z.object({
  version: z.literal(1),
  initialWorld: worldSchema,
  events: eventSchema.array(),
});

const finalScoreSchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  total: z.number(),
});

type FinalScore = z.infer<typeof finalScoreSchema>;

/** Guest announces itself so the host can name who is asking to join. */
const helloMessageSchema = z.object({
  type: z.literal('hello'),
  protocol: z.number(),
  playerName: z.string().min(1).max(40),
});

/**
 * The terms of the match, sent before the guest commits anything. The guest
 * sees the disclosure mode here and can decline.
 */
const offerMessageSchema = z.object({
  type: z.literal('offer'),
  protocol: z.number(),
  hostName: z.string(),
  rounds: z.number(),
  disclosure: disclosureSchema,
  world: z.object({ width: z.number(), height: z.number() }),
});

type OfferMessage = z.infer<typeof offerMessageSchema>;

/** Guest accepts and submits its Android in the same step. */
const acceptMessageSchema = z.object({
  type: z.literal('accept'),
  scriptName: z.string().min(1).max(60),
  script: z.string().min(1),
});

const declineMessageSchema = z.object({
  type: z.literal('decline'),
  reason: z.string().optional(),
});

const progressMessageSchema = z.object({
  type: z.literal('progress'),
  round: z.number(),
  rounds: z.number(),
});

/**
 * The end of the match. Exactly one of `game` or `recording` is present, chosen
 * by the host's disclosure mode; the schema keeps the unavailable one absent
 * rather than empty so a guest cannot mistake "not disclosed" for "empty".
 */
const resultMessageSchema = z.object({
  type: z.literal('result'),
  disclosure: disclosureSchema,
  scores: finalScoreSchema.array(),
  game: gameFileSchema.optional(),
  recording: z.string().optional(),
});

type ResultMessage = z.infer<typeof resultMessageSchema>;

const failedMessageSchema = z.object({
  type: z.literal('failed'),
  message: z.string(),
});

const guestMessageSchema = z.discriminatedUnion('type', [
  helloMessageSchema,
  acceptMessageSchema,
  declineMessageSchema,
]);

type GuestMessage = z.infer<typeof guestMessageSchema>;

const hostMessageSchema = z.discriminatedUnion('type', [
  offerMessageSchema,
  progressMessageSchema,
  resultMessageSchema,
  failedMessageSchema,
]);

type HostMessage = z.infer<typeof hostMessageSchema>;

/**
 * Invite codes are read aloud and retyped, so the alphabet leaves out the
 * characters that get confused when they are: 0/O, 1/I/L, U/V, and S/5.
 */
const codeAlphabet = 'ABCDEFGHJKMNPQRTWXYZ2346789';
const codeLength = 10;

const createInviteCode = (): string => {
  const bytes = randomBytes(codeLength);
  let code = '';
  for (let index = 0; index < codeLength; index += 1) {
    code += codeAlphabet[(bytes[index] ?? 0) % codeAlphabet.length];
  }
  return code;
};

/** Formats a code for display, grouped so it is easier to read back. */
const formatInviteCode = (code: string): string => `${code.slice(0, 5)}-${code.slice(5)}`;

/** Accepts a code as displayed, as typed without the dash, or in lower case. */
const normalizeInviteCode = (input: string): string => {
  const code = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== codeLength) {
    throw new Error(
      `Invite code must be ${codeLength} characters (for example ${formatInviteCode(createInviteCode())}).`,
    );
  }
  return code;
};

/**
 * PeerJS ids share one global namespace on the signalling server, so the code
 * is prefixed rather than used directly. This keeps invite codes short enough
 * to dictate while making collisions with unrelated PeerJS apps unlikely.
 */
const peerIdForCode = (code: string): string => `nova-match-${code.toLowerCase()}`;

export type { Disclosure, FinalScore, GuestMessage, HostMessage, OfferMessage, ResultMessage };
export {
  createInviteCode,
  disclosureSchema,
  formatInviteCode,
  guestMessageSchema,
  guestPlayerId,
  hostMessageSchema,
  hostPlayerId,
  normalizeInviteCode,
  peerIdForCode,
  protocolVersion,
};
