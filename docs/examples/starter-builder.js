/* eslint-disable complexity */
/* global androidId, world */
(() => {
  const android = world.androids.find((candidate) => candidate.id === androidId);

  if (!android || !android.active) {
    return { type: 'android.wait' };
  }

  const amount = (materials = {}) => {
    return (
      (materials.metal ?? 0) +
      (materials.electronics ?? 0) +
      (materials.polymer ?? 0) +
      (materials.ore ?? 0) +
      (materials.water ?? 0) +
      (materials.acidCanister ?? 0)
    );
  };

  const cargo = android.cargo ?? {};
  const cargoAmount = amount(cargo);
  const tile = world.tiles.find(
    (candidate) => candidate.position.x === android.position.x && candidate.position.y === android.position.y,
  );
  const building = world.buildings.find(
    (candidate) => candidate.position.x === android.position.x && candidate.position.y === android.position.y,
  );

  if (building?.ownerId === android.ownerId && building.remainingConstruction.ticks > 0) {
    return { type: 'android.continue-construction' };
  }

  if (!building && (cargo.metal ?? 0) >= 10) {
    return { type: 'android.start-construction', buildingType: 'charger', resources: { metal: 10 } };
  }

  const hasDepot = world.buildings.some(
    (candidate) => candidate.ownerId === android.ownerId && candidate.type === 'depot',
  );
  if (!building && !hasDepot && (cargo.metal ?? 0) >= 6) {
    return { type: 'android.start-construction', buildingType: 'depot', resources: { metal: 6 } };
  }

  if (building?.ownerId === android.ownerId && building.type === 'charger' && android.battery < 90) {
    return { type: 'android.charge' };
  }

  if (tile && amount(tile.scattered) > 0 && cargoAmount < 10) {
    return { type: 'android.collect' };
  }

  const openScatteredTiles = world.tiles
    .filter((candidate) => amount(candidate.scattered) > 0)
    .filter((candidate) => {
      return !world.buildings.some(
        (buildingCandidate) =>
          buildingCandidate.position.x === candidate.position.x &&
          buildingCandidate.position.y === candidate.position.y,
      );
    })
    .sort((left, right) => {
      const leftDistance =
        Math.abs(left.position.x - android.position.x) + Math.abs(left.position.y - android.position.y);
      const rightDistance =
        Math.abs(right.position.x - android.position.x) + Math.abs(right.position.y - android.position.y);
      return leftDistance - rightDistance;
    });

  const target = openScatteredTiles[0];
  if (!target) {
    return { type: 'android.broadcast', content: 'No scattered material targets remain.' };
  }

  if (android.position.x < target.position.x) {
    return { type: 'android.move', direction: 'east' };
  }

  if (android.position.x > target.position.x) {
    return { type: 'android.move', direction: 'west' };
  }

  if (android.position.y < target.position.y) {
    return { type: 'android.move', direction: 'south' };
  }

  if (android.position.y > target.position.y) {
    return { type: 'android.move', direction: 'north' };
  }

  return { type: 'android.wait' };
})();
