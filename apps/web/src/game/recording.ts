import { createBaseRuleset, eventSchema, type Event, type World, worldSchema } from '@morten-olsen/nova-game/browser';
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

const getEventLabel = (event: Event): string => {
  if ('androidId' in event) {
    return `${event.type} · ${event.androidId}`;
  }

  if ('ownerId' in event) {
    return `${event.type} · ${event.ownerId}`;
  }

  return event.type;
};

const createWorldAtEvent = (recording: Recording, eventCount: number): World => {
  const ruleset = createBaseRuleset();
  return ruleset.applyEvents(recording.initialWorld, recording.events.slice(0, eventCount));
};

const createTimeline = (recording: Recording): TimelineFrame[] => {
  const initialFrame: TimelineFrame = {
    index: 0,
    label: 'Initial world',
    world: structuredClone(recording.initialWorld),
  };
  const eventFrames = recording.events.map((event, index): TimelineFrame => {
    const eventCount = index + 1;
    return {
      index: eventCount,
      label: getEventLabel(event),
      world: createWorldAtEvent(recording, eventCount),
    };
  });

  return [initialFrame, ...eventFrames];
};

const parseRecording = (content: string): Recording => recordingSchema.parse(JSON.parse(content));

export type { Recording, TimelineFrame };
export { createTimeline, parseRecording };
