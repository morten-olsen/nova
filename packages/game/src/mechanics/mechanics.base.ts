import type { Event } from '../events/events.js';
import type { World } from '../schemas/schemas.world.js';

type MechanicSetupOptions = {
  world: World;
};

type MechanicApplyOptions = {
  world: World;
  event: Event;
};

type Mechanic = {
  name: string;
  setup?: (options: MechanicSetupOptions) => void;
  apply?: (options: MechanicApplyOptions) => void;
};

export type { MechanicSetupOptions, MechanicApplyOptions, Mechanic };
