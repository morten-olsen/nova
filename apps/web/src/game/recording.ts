import { createBaseRuleset, eventSchema, type Event, type World, worldSchema } from '@morten-olsen/nova-game/browser';
import { z } from 'zod';

const recordingSchema = z.object({
  version: z.literal(1),
  initialWorld: worldSchema,
  events: eventSchema.array(),
});

type Recording = z.infer<typeof recordingSchema>;

type TimelineFrame = {
  /** Events applied during the round that produced this frame. */
  events: Event[];
  index: number;
  label: string;
  round: number;
  world: World;
};

const createTimeline = (recording: Recording): TimelineFrame[] => {
  const ruleset = createBaseRuleset();
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

const parseRecording = (content: string): Recording => recordingSchema.parse(JSON.parse(content));

export type { Recording, TimelineFrame };
export { createTimeline, parseRecording, usesFogOfWar };
