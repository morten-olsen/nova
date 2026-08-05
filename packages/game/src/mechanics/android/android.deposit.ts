import { addMaterials, normalizeMaterials } from '../../schemas/schemas.resources.js';
import type { Mechanic } from '../mechanics.base.js';

import { getAndroid, getBuildingAt, takeFromAndroidCargo } from './android.helpers.js';

const androidMechanicsDeposit: Mechanic = {
  name: 'android.deposit',
  apply: ({ world, event }) => {
    if (event.type !== 'android.deposit') {
      return;
    }

    const android = getAndroid(world, event.androidId);
    const building = getBuildingAt(world, android.position);
    if (
      !building ||
      building.ownerId !== android.ownerId ||
      !['depot', 'processor', 'acid-processing-plant'].includes(building.type)
    ) {
      throw new Error('Android must be on an owned storage-capable building to deposit');
    }

    const resources = event.resources ? normalizeMaterials(event.resources) : normalizeMaterials(android.cargo);
    takeFromAndroidCargo(android, resources);
    building.storage = addMaterials(building.storage, resources);
  },
};

export { androidMechanicsDeposit };
