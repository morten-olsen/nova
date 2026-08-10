import { type Event, eventSchema } from '../events/events.js';
import type { GameRecording } from '../recording/recording.js';
import { createBaseRuleset } from '../ruleset/ruleset.base.js';
import type { World } from '../schemas/schemas.world.js';
import { redactedValue } from '../script-runner/world-projection.js';

/** Returns the complete game state while hiding another player's executable and persisted Android state. */
const projectWorldForPlayer = (world: World, playerId: string): World =>
  structuredClone({
    ...world,
    scripts: world.scripts.map((script) => ({
      ...script,
      ...(script.ownerId === playerId ? {} : { content: redactedValue }),
    })),
    androids: world.androids.map((android) => ({
      ...android,
      ...(android.ownerId === playerId ? {} : { memory: redactedValue, recording: redactedValue }),
    })),
  });

const redactEventForPlayer = (event: Event, world: World, playerId: string): Event => {
  if (event.type === 'user.upload-android-script' && event.ownerId !== playerId) {
    return eventSchema.parse({ ...event, content: redactedValue });
  }

  if ('androidId' in event) {
    const android = world.androids.find((candidate) => candidate.id === event.androidId);
    if (android?.ownerId !== playerId && ('memory' in event || 'recording' in event)) {
      return eventSchema.parse({
        ...event,
        ...(event.memory === undefined ? {} : { memory: redactedValue }),
        ...(event.recording === undefined ? {} : { recording: redactedValue }),
      });
    }
  }

  return structuredClone(event);
};

/**
 * Produces a replay that can be rendered normally without disclosing another
 * player's script source or Android memory/recording.
 */
const projectRecordingForPlayer = (recording: GameRecording, playerId: string): GameRecording => {
  const ruleset = createBaseRuleset();
  const initialWorld = ruleset.buildWorld(structuredClone(recording.initialWorld));
  let world = initialWorld;
  const events = recording.events.map((event) => {
    const projectedEvent = redactEventForPlayer(event, world, playerId);
    world = ruleset.applyEvents(world, [event]);
    return projectedEvent;
  });

  return {
    version: recording.version,
    initialWorld: projectWorldForPlayer(initialWorld, playerId),
    events,
  };
};

export { projectRecordingForPlayer, projectWorldForPlayer };
