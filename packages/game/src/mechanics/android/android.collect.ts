import {
  materialAmount,
  materialKeys,
  normalizeMaterials,
  subtractMaterials,
  type MaterialBundle,
} from '../../schemas/schemas.resources.js';
import type { Mechanic } from '../mechanics.base.js';

import { addToAndroidCargo, getAndroid, getTileAt } from './android.helpers.js';

const androidMechanicsCollect: Mechanic = {
  name: 'android.collect',
  apply: ({ world, event, rules }) => {
    if (event.type !== 'android.collect') {
      return;
    }

    const android = getAndroid(world, event.androidId);
    const tile = getTileAt(world, android.position);
    if (!tile) {
      throw new Error('Android is not on a tile');
    }

    const capacity = rules.android.cargoCapacity;
    const available = normalizeMaterials(tile.scattered);
    const requested = event.resources ? normalizeMaterials(event.resources) : available;
    const collected: MaterialBundle = {};
    let remainingCapacity = capacity - materialAmount(android.cargo);

    for (const key of materialKeys) {
      const amount = Math.min(available[key] ?? 0, requested[key] ?? 0, remainingCapacity);
      collected[key] = amount;
      remainingCapacity -= amount;
    }

    if (materialAmount(collected) <= 0) {
      throw new Error('No scattered material available to collect');
    }

    addToAndroidCargo(android, collected, capacity);
    tile.scattered = subtractMaterials(tile.scattered, collected);
  },
};

export { androidMechanicsCollect };
