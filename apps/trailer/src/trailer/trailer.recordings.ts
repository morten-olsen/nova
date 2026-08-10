import { eventSchema, worldSchema } from '@morten-olsen/nova-game/browser';
import { z } from 'zod';

import colonyRaceJson from '../../../../examples/games/trailer-colony-race.json';
import firstLightJson from '../../../../examples/games/trailer-first-light.json';
import { createTimeline, type Recording, type TimelineFrame } from '../board/board.timeline.ts';

/**
 * The trailer plays the committed recordings rather than regenerating them, so
 * what it shows is exactly what `pnpm nova play` shows for the same file. The
 * schemas are the game's own: a recording that has drifted out of shape fails
 * here with a field path instead of rendering ninety seconds of empty board.
 */
const recordingSchema = z.object({
  events: eventSchema.array(),
  initialWorld: worldSchema,
  version: z.literal(1),
});

const parse = (name: string, value: unknown): Recording => {
  const result = recordingSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`Recording '${name}' is not a valid Nova recording: ${z.prettifyError(result.error)}`);
  }
  return result.data as Recording;
};

type Scene = {
  /** One world snapshot per completed round; the index camera cues address. */
  frames: TimelineFrame[];
  recording: Recording;
};

const toScene = (name: string, value: unknown): Scene => {
  const recording = parse(name, value);
  return { frames: createTimeline(recording), recording };
};

/** Act one: round 0, one Android, a board nobody has looked at. */
const firstLight = toScene('trailer-first-light', firstLightJson);

/** Act two: round 46, two colony programmes and an acid plain between them. */
const colonyRace = toScene('trailer-colony-race', colonyRaceJson);

export type { Scene };
export { colonyRace, firstLight };
