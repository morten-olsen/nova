import { constructionMechanicsContinueConstruction } from './construction.continue-construction.js';
import { constructionMechanicsRepair } from './construction.repair.js';
import { constructionMechanicsSalvage } from './construction.salvage.js';
import { constructionMechanicsStartConstruction } from './construction.start-construction.js';

const constructionMechanics = [
  constructionMechanicsStartConstruction,
  constructionMechanicsContinueConstruction,
  constructionMechanicsSalvage,
  constructionMechanicsRepair,
];

export { constructionMechanics };
