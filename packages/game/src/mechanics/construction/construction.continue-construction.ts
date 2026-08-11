import { hasMaterials, materialAmount, subtractMaterials } from '../../schemas/schemas.resources.js';
import type { Mechanic } from '../mechanics.base.js';
import { getAndroid, getBuildingAt, takeFromAndroidCargo } from '../android/android.helpers.js';

const constructionMechanicsContinueConstruction: Mechanic = {
  name: 'construction.continue-construction',
  apply: ({ world, event }) => {
    if (event.type !== 'android.continue-construction') {
      return;
    }

    const android = getAndroid(world, event.androidId);
    const building = getBuildingAt(world, android.position);
    if (!building || building.ownerId !== android.ownerId) {
      throw new Error('Android must be on an owned construction site');
    }

    if (event.resources) {
      if (!hasMaterials(building.remainingConstruction.resources, event.resources)) {
        throw new Error('Construction does not need requested materials');
      }

      takeFromAndroidCargo(android, event.resources);
      building.remainingConstruction.resources = subtractMaterials(
        building.remainingConstruction.resources,
        event.resources,
      );
    }

    if (materialAmount(building.remainingConstruction.resources) <= 0) {
      building.remainingConstruction.ticks = Math.max(0, building.remainingConstruction.ticks - 1);
    }
  },
};

export { constructionMechanicsContinueConstruction };
