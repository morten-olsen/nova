import { createBaseRuleset, eventSchema, type World, worldSchema } from '@morten-olsen/nova-game/browser';
import { z } from 'zod';

const recordingSchema = z.object({
  version: z.literal(1),
  initialWorld: worldSchema,
  events: eventSchema.array(),
});

type Recording = z.infer<typeof recordingSchema>;

type TimelineFrame = {
  index: number;
  label: string;
  world: World;
};

const createTimeline = (recording: Recording): TimelineFrame[] => {
  const ruleset = createBaseRuleset();
  let world = structuredClone(recording.initialWorld);
  const frames: TimelineFrame[] = [{ index: 0, label: `Round ${world.round ?? 0}`, world }];
  for (const [index, event] of recording.events.entries()) {
    world = ruleset.applyEvents(world, [event]);
    if (event.type === 'game.round-end') {
      frames.push({ index: index + 1, label: `Round ${world.round ?? frames.length}`, world });
    }
  }
  return frames;
};

const parseRecording = (content: string): Recording => recordingSchema.parse(JSON.parse(content));

export type { Recording, TimelineFrame };
export { createTimeline, parseRecording };
