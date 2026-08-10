import { z } from 'zod';

import { eventSchema, type Event } from '../events/events.js';
import { createBaseRuleset } from '../ruleset/ruleset.base.js';
import type { Ruleset } from '../ruleset/ruleset.js';
import { worldSchema, type World } from '../schemas/schemas.world.js';

/**
 * The on-disk and over-the-wire form of a played game: a starting world plus
 * every event that followed. The CLI writes it, the replay viewer and the IDE
 * read it, so it is defined once here rather than per consumer.
 */
const gameRecordingSchema = z.object({
  version: z.literal(1),
  initialWorld: worldSchema,
  events: eventSchema.array(),
});

type GameRecording = z.infer<typeof gameRecordingSchema>;

const parseRecording = (content: string): GameRecording => gameRecordingSchema.parse(JSON.parse(content));

type TimelineFrame = {
  /** Events applied during the round that produced this frame. */
  events: Event[];
  index: number;
  label: string;
  round: number;
  world: World;
};

/**
 * Replays a recording into one frame per completed round.
 *
 * The ruleset is a parameter because a recording is only events — replaying it
 * under different mechanics than produced it yields a different world, so the
 * caller has to supply the one the game was played with.
 */
const createTimeline = (recording: GameRecording, ruleset: Ruleset = createBaseRuleset()): TimelineFrame[] => {
  let world = structuredClone(recording.initialWorld);
  const frames: TimelineFrame[] = [
    { events: [], index: 0, label: `Round ${world.round ?? 0}`, round: world.round ?? 0, world },
  ];
  let pending: Event[] = [];
  for (const [index, event] of recording.events.entries()) {
    world = ruleset.applyEvents(world, [event]);
    pending.push(event);
    if (event.type === 'game.round-end') {
      const round = world.round ?? frames.length;
      frames.push({ events: pending, index: index + 1, label: `Round ${round}`, round, world });
      pending = [];
    }
  }
  return frames;
};

/**
 * Whether this recording uses fog of war at all.
 *
 * Has to be answered across the whole timeline: tiles are revealed at round end,
 * so the opening frame of a real game has nothing revealed and would otherwise
 * look identical to a recording that predates fog — turning fog off exactly when
 * the board should be fully dark.
 */
const usesFogOfWar = (frames: TimelineFrame[]): boolean =>
  frames.some((frame) => frame.world.tiles.some((tile) => (tile.revealedBy?.length ?? 0) > 0));

export type { GameRecording, TimelineFrame };
export { createTimeline, gameRecordingSchema, parseRecording, usesFogOfWar };
