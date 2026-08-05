import type { Mechanic } from '../mechanics.base.js';

import { ensurePlayer } from './user.helpers.js';

const userMechanicsLaunchAndroid: Mechanic = {
  name: 'user.launch-android',
  apply: ({ world, event }) => {
    if (event.type !== 'user.launch-android') {
      return;
    }

    ensurePlayer(world, event.ownerId);

    const script = world.scripts.find(
      (candidate) => candidate.id === event.scriptId && candidate.ownerId === event.ownerId,
    );
    if (!script) {
      throw new Error(`Unknown script for owner: ${event.scriptId}`);
    }

    const ownerChargers = world.buildings.filter(
      (building) =>
        building.ownerId === event.ownerId &&
        building.type === 'charger' &&
        building.remainingConstruction.ticks === 0 &&
        (building.remainingConstruction.resources.metal ?? 0) === 0,
    );
    const activeAndroids = world.androids.filter(
      (android) => android.ownerId === event.ownerId && android.active,
    ).length;

    if (activeAndroids >= ownerChargers.length) {
      throw new Error(`Android capacity reached for owner: ${event.ownerId}`);
    }

    const spawnPosition = ownerChargers[0]?.position ?? world.tiles[0]?.position ?? { x: 0, y: 0 };
    world.androids.push({
      id: `android-${world.androids.length + 1}`,
      ownerId: event.ownerId,
      scriptId: event.scriptId,
      position: { ...spawnPosition },
      battery: 100,
      health: 100,
      active: true,
      cargo: { metal: 0, electronics: 0, polymer: 0 },
    });
  },
};

export { userMechanicsLaunchAndroid };
