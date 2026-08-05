import { Event } from '../events/events.js';
import { Ruleset } from '../ruleset/ruleset.js';
import { World } from '../schemas/schemas.world.js';
import { ScriptRunner } from '../script-runner/script-runner.js';

type LoopOptions = {
  initWorld?: World;
  events?: Event[];
  ruleset: Ruleset;
};

class Loop {
  #options: LoopOptions;
  #initWorld: World;
  #world: World;
  #events: Event[];
  #scriptRunner: ScriptRunner;

  constructor(options: LoopOptions) {
    this.#options = options;
    const { ruleset } = this.#options;
    const initWorld =
      options.initWorld ??
      ({
        tiles: [],
        scripts: [],
        androids: [],
        buildings: [],
        players: [],
        messages: [],
        round: 0,
      } satisfies World);
    this.#initWorld = ruleset.buildWorld(initWorld);
    this.#world = structuredClone(this.#initWorld);
    this.#events = [];
    this.#scriptRunner = new ScriptRunner();
    if (options.events) {
      this.applyEvents(options.events);
    }
  }

  public get world() {
    return structuredClone(this.#world);
  }

  public get events() {
    return structuredClone(this.#events);
  }

  public applyEvents = (events: Event[]) => {
    const { ruleset } = this.#options;
    this.#world = ruleset.applyEvents(this.#world, events);
    this.#events.push(...structuredClone(events));
  };

  public run = async () => {
    const { ruleset } = this.#options;
    let world = this.#world;

    const events: Event[] = [];
    const applyEvent = (event: Event) => {
      world = ruleset.applyEvents(world, [event]);
      events.push(event);
    };

    applyEvent({ type: 'game.round-start' });

    const androidIds = world.androids.filter((android) => android.active).map((android) => android.id);

    for (const androidId of androidIds) {
      const android = world.androids.find((android) => android.id === androidId);
      if (!android?.active) {
        continue;
      }

      const { scriptId, ownerId } = android;
      const script = world.scripts.find((script) => script.id === scriptId && script.ownerId === ownerId);
      if (!script) {
        continue;
      }
      try {
        const event = this.#scriptRunner.execute({
          androidId,
          content: script.content,
          world: structuredClone(world),
        });
        applyEvent(event);
      } catch (err) {
        applyEvent({
          type: 'game.android-failed-turn',
          androidId: android.id,
          error: {
            message: String(err),
          },
        });
      }
    }

    applyEvent({ type: 'game.round-end' });

    this.#events.push(...events);
    this.#world = world;
  };
}

export type { LoopOptions };
export { Loop };
