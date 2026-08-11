import { addMaterials, normalizeMaterials } from '../../schemas/schemas.resources.js';
import { isBuildingComplete } from '../../utils/utils.building.js';
import type { Mechanic } from '../mechanics.base.js';

import { getAndroid, getBuildingAt, takeFromAndroidCargo } from './android.helpers.js';

const androidMechanicsDeposit: Mechanic = {
  name: 'android.deposit',
  apply: ({ world, event, rules }) => {
    if (event.type !== 'android.deposit') {
      return;
    }

    const android = getAndroid(world, event.androidId);
    const building = getBuildingAt(world, android.position);
    const storage = building ? rules.buildings[building.type].storage : null;
    // A site is not a warehouse: material left in one neither scores nor
    // survives the building being taken apart, so depositing into it is a hole
    // in the floor rather than a shortcut.
    if (!building || building.ownerId !== android.ownerId || !storage?.deposit || !isBuildingComplete(building)) {
      throw new Error('Android must be on an owned completed storage-capable building to deposit');
    }

    const resources = event.resources ? normalizeMaterials(event.resources) : normalizeMaterials(android.cargo);
    takeFromAndroidCargo(android, resources);
    building.storage = addMaterials(building.storage, resources);
  },
};

export { androidMechanicsDeposit };
