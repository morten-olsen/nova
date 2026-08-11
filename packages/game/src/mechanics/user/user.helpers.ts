import type { Rules } from '../../rules/rules.js';
import type { World } from '../../schemas/schemas.world.js';
import { placeInitialCharger } from '../../utils/utils.starter-position.js';

const ensureWorldCollections = (world: World): void => {
  world.players ??= [];
  world.messages ??= [];
  world.round ??= 0;
};

const ensurePlayer = (world: World, ownerId: string, rules: Rules): void => {
  ensureWorldCollections(world);

  const players = world.players ?? [];
  world.players = players;

  if (!players.some((player) => player.id === ownerId)) {
    players.push({ id: ownerId, name: ownerId });
  }

  // The same starting tiles world setup uses, so a game whose players arrive one
  // upload at a time still puts them in opposite corners.
  placeInitialCharger(world, ownerId, rules);
};

export { ensurePlayer, ensureWorldCollections };
