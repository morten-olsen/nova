// The android script contract, as TypeScript sees it.
//
// The sandbox injects `world` and its four companions as globals, so no import
// can introduce them and no module can declare them: an android is compiled
// against this file instead. It is opt-in through the `./android` export rather
// than part of the package's main types, because a global named `world` is the
// last thing a host application wants pulled into scope.
//
// Two consumers, both reaching the same file through node_modules. A factory
// names it in `tsconfig.json`:
//
//     "types": ["@morten-olsen/nova-game/android"]
//
// and the browser lab hands the same text to Monaco. Everything is global, so
// an android needs no imports — which matters in the lab, where a script is
// type-stripped rather than bundled and a surviving `import` would reach the
// sandbox.
//
// Every model type is an alias of the engine's own, so an action added to the
// game arrives here with the package. Only the five globals are written by
// hand, and they are fixed by the sandbox bootstrap rather than by the rules.

import type {
  Android as NovaAndroid,
  AndroidAction,
  AndroidRules as NovaAndroidRules,
  Building as NovaBuilding,
  BuildingRules as NovaBuildingRules,
  BuildingType as NovaBuildingType,
  Direction as NovaDirection,
  MaterialBundle as NovaMaterialBundle,
  Message as NovaMessage,
  Player as NovaPlayer,
  Position as NovaPosition,
  Rules as NovaRules,
  Script as NovaScript,
  Tile as NovaTile,
  TileComposition as NovaTileComposition,
  World as NovaWorld,
} from '@morten-olsen/nova-game';

declare global {
  type Position = NovaPosition;
  type Direction = NovaDirection;
  type MaterialBundle = NovaMaterialBundle;
  type TileComposition = NovaTileComposition;
  type Tile = NovaTile;
  type Android = NovaAndroid;
  type BuildingType = NovaBuildingType;
  type Building = NovaBuilding;
  type Message = NovaMessage;
  type Player = NovaPlayer;
  type Script = NovaScript;

  /** Every number this match is played with. See the `rules` global. */
  type Rules = NovaRules;
  type AndroidRules = NovaAndroidRules;
  type BuildingRules = NovaBuildingRules;

  /**
   * The world as this android can see it. Tiles your owner has not revealed are
   * absent, as is anything standing on them — treat a missing tile as unknown,
   * not as empty.
   */
  type World = NovaWorld;

  /**
   * One turn's decision. `memory` and `recording` may be set on any action:
   * `memory` is private working state (4,096 characters) and `recording` is the
   * player-facing log (16,384 characters) that outlives the android. Both
   * replace the previous value, and both are discarded with the turn if the
   * action is refused.
   */
  type Action = AndroidAction;

  /**
   * What an android entry file default-exports when the CLI assembles it from
   * more than one file: called once per round, returns that round's action.
   *
   * ```ts
   * const turn: AndroidTurn = () => ({ type: 'android.wait' });
   * export default turn;
   * ```
   *
   * A single-file android may instead end in a bare action expression, which is
   * what the browser lab writes.
   */
  type AndroidTurn = () => Action;

  /** The id of the android whose turn is running. */
  const androidId: string;

  /** A fogged snapshot of the world for this turn. */
  const world: World;

  /**
   * Every number this match is played with: cargo capacity, battery costs,
   * hazard damage, build costs and times, sight ranges, salvage rates, what
   * scores, and the board's `width` and `height`.
   *
   * Read from here rather than copying a number out of the rulebook. Nothing in
   * this object is guaranteed to match the defaults — a host can retune any of
   * it — so an android that asks is one that still works on a smaller board or
   * with smaller hands.
   *
   * `rules.script` is this turn's own resource budget: CPU ticks, wall clock and
   * heap. A plan expensive enough to be worth budgeting should be sized from
   * there rather than from the numbers in the manual.
   *
   * ```ts
   * const capacity = rules.android.cargoCapacity;
   * const depotCost = rules.buildings.depot.cost.metal ?? 0;
   * const onMap = (p: Position) => p.x >= 0 && p.y >= 0 && p.x < rules.world.width && p.y < rules.world.height;
   * ```
   */
  const rules: Rules;

  /** The turn now being played, counting from 1. */
  const turn: number;

  /**
   * The turn the humans are expected to land on, or `undefined` when the game has
   * no arrival date.
   *
   * A deadline rather than a mechanic: nothing happens to the world on that turn,
   * but readiness banked after it arrived too late to matter. Compare against
   * `turn` to know how much time is left, and check for `undefined` first — an
   * open-ended game does not set one.
   *
   * ```ts
   * const turnsLeft = finalTurn === undefined ? Infinity : finalTurn - turn;
   * const canFinish = (type: BuildingType) => rules.buildings[type].ticks <= turnsLeft;
   * ```
   */
  const finalTurn: number | undefined;
}

export {};
