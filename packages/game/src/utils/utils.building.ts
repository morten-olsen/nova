import type { Building } from '../schemas/schemas.building.js';
import { materialAmount, materialKeys, normalizeMaterials, type MaterialBundle } from '../schemas/schemas.resources.js';

/**
 * Whether a building is finished, and so whether it does anything at all.
 *
 * One definition, used by every mechanic that asks the question, because a
 * building that charges androids but does not score — or scores but cannot be
 * launched from — is a building two mechanics disagree about. Both halves are
 * load-bearing: a type given `ticks: 0` by a ruleset would otherwise count as
 * complete the moment its site was placed, before a single unit of its cost was
 * delivered.
 */
const isBuildingComplete = (building: Building): boolean =>
  building.remainingConstruction.ticks === 0 && materialAmount(building.remainingConstruction.resources) === 0;

/**
 * What has actually been paid into a building.
 *
 * Its cost, less whatever it is still owed, so a site that was placed and never
 * supplied has been paid nothing. Salvage returns a share of *this* rather than
 * of the full cost: otherwise placing a site and taking it apart again is a way
 * to manufacture material the player never had.
 */
const investedMaterials = (building: Building, cost: MaterialBundle): MaterialBundle => {
  const owed = normalizeMaterials(building.remainingConstruction.resources);
  const invested = normalizeMaterials(cost);
  for (const material of materialKeys) {
    invested[material] = Math.max(0, (invested[material] ?? 0) - (owed[material] ?? 0));
  }
  return invested;
};

export { investedMaterials, isBuildingComplete };
