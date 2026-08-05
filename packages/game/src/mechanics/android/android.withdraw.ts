import { hasMaterials, subtractMaterials } from '../../schemas/schemas.resources.js';
import type { Mechanic } from '../mechanics.base.js';

import { addToAndroidCargo, getAndroid, getBuildingAt } from './android.helpers.js';

const androidMechanicsWithdraw: Mechanic = {
  name: 'android.withdraw',
  apply: ({ world, event }) => {
    if (event.type !== 'android.withdraw') {
      return;
    }

    const android = getAndroid(world, event.androidId);
    const building = getBuildingAt(world, android.position);
    if (
      !building ||
      building.ownerId !== android.ownerId ||
      !['depot', 'extractor', 'processor', 'acid-processing-plant'].includes(building.type)
    ) {
      throw new Error('Android must be on an owned storage-capable building to withdraw');
    }

    if (!hasMaterials(building.storage, event.resources)) {
      throw new Error('Depot does not have requested materials');
    }

    addToAndroidCargo(android, event.resources);
    building.storage = subtractMaterials(building.storage, event.resources);
  },
};

export { androidMechanicsWithdraw };
