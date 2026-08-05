import { eventSchema, type Event } from '../events/events.js';
import type { Mechanic } from '../mechanics/mechanics.base.js';
import type { World } from '../schemas/schemas.world.js';

type RulesetOptions = {
  mechanics: Mechanic[];
};

class Ruleset {
  #options: RulesetOptions;

  constructor(options: RulesetOptions) {
    this.#options = options;
  }

  buildWorld = (init: World) => {
    const { mechanics } = this.#options;
    return mechanics.reduce((current, mechanic) => {
      const world = structuredClone(current);

      if (mechanic.setup) {
        mechanic.setup({ world });
      }
      return world;
    }, init);
  };

  public applyEvents = (world: World, events: Event[]) => {
    const { mechanics } = this.#options;
    return events.reduce((current, event) => {
      const parsedEvent = eventSchema.parse(structuredClone(event));

      return mechanics.reduce((current, mechanic) => {
        const world = structuredClone(current);

        if (mechanic.apply) {
          mechanic.apply({
            world,
            event: parsedEvent,
          });
        }
        return world;
      }, current);
    }, world);
  };
}

export type { RulesetOptions };
export { Ruleset };
