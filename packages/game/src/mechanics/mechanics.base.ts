import type { Event } from '../events/events.js';
import type { Rules } from '../rules/rules.js';
import type { World } from '../schemas/schemas.world.js';

type MechanicSetupOptions = {
  world: World;
  /** Resolved rules for the match being set up. Never mutate them. */
  rules: Rules;
};

type MechanicApplyOptions = {
  world: World;
  event: Event;
  /** Resolved rules for the match this event belongs to. Never mutate them. */
  rules: Rules;
};

type Mechanic = {
  name: string;
  setup?: (options: MechanicSetupOptions) => void;
  apply?: (options: MechanicApplyOptions) => void;
};

export type { MechanicSetupOptions, MechanicApplyOptions, Mechanic };
