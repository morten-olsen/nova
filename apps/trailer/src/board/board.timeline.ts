import { createBaseRuleset, type Event, type World } from '@morten-olsen/nova-game';

type Recording = {
  events: Event[];
  initialWorld: World;
  version: 1;
};

type TimelineFrame = {
  /** Index into the frame list, which is what camera cues address. */
  index: number;
  round: number;
  world: World;
};

/**
 * Replays a recording into one world snapshot per completed round.
 *
 * Rounds are the only sensible cut points: tile visibility, extraction,
 * processing and Android decay all resolve at `game.round-end`, so a snapshot
 * taken mid-round is a world in which half the rules have run.
 */
const createTimeline = (recording: Recording): TimelineFrame[] => {
  const ruleset = createBaseRuleset();
  let world = structuredClone(recording.initialWorld);
  const frames: TimelineFrame[] = [{ index: 0, round: world.round ?? 0, world }];

  for (const event of recording.events) {
    world = ruleset.applyEvents(world, [event]);
    if (event.type === 'game.round-end') {
      frames.push({ index: frames.length, round: world.round ?? frames.length, world });
    }
  }

  return frames;
};

/**
 * Whether this recording uses fog at all, answered across the whole timeline.
 *
 * A recording that starts at round 0 has nothing revealed in its first frame,
 * which is indistinguishable from a recording made before fog existed. Deciding
 * per frame turns fog off for exactly the shot that wants the board dark.
 */
const usesFogOfWar = (frames: TimelineFrame[]): boolean =>
  frames.some((frame) => frame.world.tiles.some((tile) => (tile.revealedBy?.length ?? 0) > 0));

export type { Recording, TimelineFrame };
export { createTimeline, usesFogOfWar };
