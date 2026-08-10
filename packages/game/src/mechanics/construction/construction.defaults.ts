import type { BuildingType } from '../../schemas/schemas.building.js';
import type { MaterialBundle } from '../../schemas/schemas.resources.js';

const buildingCosts: Record<BuildingType, MaterialBundle> = {
  charger: { metal: 10 },
  'relay-tower': { metal: 8, electronics: 4 },
  depot: { metal: 6 },
  extractor: { metal: 12, electronics: 2 },
  processor: { metal: 15, electronics: 4, polymer: 2 },
  'acid-processing-plant': { metal: 12, electronics: 3, polymer: 2 },
  scanner: { metal: 8, electronics: 6 },
  radar: { metal: 14, electronics: 10, polymer: 2 },
  'colony-module': { metal: 50, electronics: 20, polymer: 20 },
};

const buildingTicks: Record<BuildingType, number> = {
  charger: 2,
  'relay-tower': 3,
  depot: 2,
  extractor: 5,
  processor: 6,
  'acid-processing-plant': 5,
  scanner: 4,
  radar: 7,
  'colony-module': 12,
};

export { buildingCosts, buildingTicks };
