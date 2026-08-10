/**
 * The Android programs shipped inside the trailer recordings.
 *
 * These are real scripts for the real runner — one expression's completion value
 * is the Android's action for the round, `world` is the fogged projection and
 * `androidId` is the Android taking its turn. They are also what the trailer puts
 * on screen, so the code a viewer reads is the code in the recording rather than
 * something written to look plausible.
 */

const cargoTotal = `const carried = Object.values(me.cargo ?? {}).reduce((sum, n) => sum + n, 0);`;

const findMe = `const me = world.androids.find((a) => a.id === androidId);`;

const findHere = `const here = world.tiles.find(
  (t) => t.position.x === me.position.x && t.position.y === me.position.y,
);`;

const auroraProspector = `// aurora-prospector v2 — find loose material, bank it, build outward.
${findMe}
${findHere}
${cargoTotal}
const loose = Object.values(here.scattered ?? {}).reduce((sum, n) => sum + n, 0);
const depot = world.buildings.find(
  (b) => b.ownerId === me.ownerId && b.type === 'depot',
);

if (loose > 0 && carried < 10) {
  ({ type: 'android.collect', memory: 'hauling' });
} else if (!depot && carried >= 6) {
  ({ type: 'android.start-construction', buildingType: 'depot', resources: { metal: 6 } });
} else if (depot && depot.remainingConstruction.ticks > 0) {
  ({ type: 'android.continue-construction' });
} else if (depot && carried > 0) {
  ({ type: 'android.deposit' });
} else {
  ({ type: 'android.move', direction: me.memory === 'hauling' ? 'west' : 'east' });
}`;

const auroraColonyCrew = `// aurora-colony-crew v6 — one job: put the colony module up.
${findMe}
const site = world.buildings.find(
  (b) => b.ownerId === me.ownerId && b.type === 'colony-module',
);
const onSite =
  site && site.position.x === me.position.x && site.position.y === me.position.y;

if (onSite && site.remainingConstruction.ticks > 0) {
  ({ type: 'android.continue-construction', recording: 'tick ' + site.remainingConstruction.ticks });
} else if (site && !onSite) {
  ({
    type: 'android.move',
    direction: site.position.y < me.position.y ? 'north' : 'south',
  });
} else {
  ({ type: 'android.wait', memory: 'module-complete' });
}`;

const auroraHauler = `// aurora-hauler v3 — cross the plain to the east cache field.
// TODO(v4): read here.composition.acid before stepping. Cost us three units.
${findMe}
${findHere}
${cargoTotal}

if (carried >= 10) {
  ({ type: 'android.move', direction: 'west' });
} else if ((here.scattered?.metal ?? 0) > 0) {
  ({ type: 'android.collect' });
} else {
  // Straight line east. Nothing here asks what is on the next tile.
  ({ type: 'android.move', direction: me.position.y > 6 ? 'north' : 'east' });
}`;

const borealisReclaimer = `// borealis-reclaimer v4 — take the eye, then take the scrap.
${findMe}
const target = world.buildings.find(
  (b) =>
    b.ownerId !== me.ownerId &&
    (b.type === 'scanner' || b.type === 'radar') &&
    !b.initial,
);
const onTarget =
  target && target.position.x === me.position.x && target.position.y === me.position.y;

if (onTarget) {
  ({ type: 'android.salvage', recording: 'salvaging ' + target.type + ' @ ' + target.health });
} else if (target) {
  ({
    type: 'android.move',
    direction: target.position.x < me.position.x ? 'west' : 'north',
  });
} else {
  ({ type: 'android.collect' });
}`;

const borealisTerraformer = `// borealis-terraformer v5 — clean the flats, and never stand in them.
${findMe}
const acidAt = (x, y) => {
  const tile = world.tiles.find((t) => t.position.x === x && t.position.y === y);
  return tile ? (tile.composition.acid ?? 0) : 0;
};
const neighbours = [
  ['west', me.position.x - 1, me.position.y],
  ['north', me.position.x, me.position.y - 1],
  ['south', me.position.x, me.position.y + 1],
];
const dirty = neighbours.find(([, x, y]) => acidAt(x, y) > 0);

if (dirty) {
  ({ type: 'android.clean-acid', direction: dirty[0] });
} else if (acidAt(me.position.x - 1, me.position.y) === 0) {
  // Only ever step onto ground this Android has already cleaned.
  ({ type: 'android.move', direction: 'west' });
} else {
  ({ type: 'android.wait' });
}`;

const borealisSupply = `// borealis-supply v2 — cache to processor, processor to new capacity.
${findMe}
${cargoTotal}
${findHere}
const store = world.buildings.find(
  (b) =>
    b.ownerId === me.ownerId &&
    b.type === 'processor' &&
    b.position.x === me.position.x &&
    b.position.y === me.position.y,
);

if (store && carried > 0) {
  ({ type: 'android.deposit' });
} else if (carried === 0 && Object.values(here.scattered ?? {}).some((n) => n > 0)) {
  ({ type: 'android.collect' });
} else if (carried >= 10) {
  ({ type: 'android.start-construction', buildingType: 'charger', resources: { metal: 10 } });
} else {
  ({ type: 'android.move', direction: 'north' });
}`;

export { auroraColonyCrew, auroraHauler, auroraProspector, borealisReclaimer, borealisSupply, borealisTerraformer };
