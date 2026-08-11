import { eventSchema, type Event } from '../events/events.js';
import type { Mechanic } from '../mechanics/mechanics.base.js';
import { resolveRules, type Rules, type RulesInput } from '../rules/rules.js';
import type { World } from '../schemas/schemas.world.js';

type RulesetOptions = {
  mechanics: Mechanic[];
  /** Any subset of the rules; everything left out takes its default. */
  rules?: RulesInput;
};

class Ruleset {
  #options: RulesetOptions;
  #rules: Rules;

  constructor(options: RulesetOptions) {
    this.#options = options;
    // Resolved once, here, rather than per event: mechanics read fully populated
    // rules, and a ruleset that answered a different set of numbers on its
    // second event would not be a ruleset.
    this.#rules = resolveRules(options.rules);
  }

  /**
   * The rules every mechanic is being handed.
   *
   * Public because a host needs them beyond the mechanics: the loop passes them
   * to scripts, and a recording stores them so a replay is played under the
   * rules that produced it.
   */
  public get rules(): Rules {
    return this.#rules;
  }

  buildWorld = (init: World) => {
    const { mechanics } = this.#options;
    return mechanics.reduce((current, mechanic) => {
      const world = structuredClone(current);

      if (mechanic.setup) {
        mechanic.setup({ world, rules: this.#rules });
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
            rules: this.#rules,
          });
        }
        return world;
      }, current);
    }, world);
  };
}

export type { RulesetOptions };
export { Ruleset };
