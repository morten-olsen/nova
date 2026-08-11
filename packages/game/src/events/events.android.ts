import { z } from 'zod';

import { directionSchema, idSchema } from '../schemas/schemas.base.js';
import { buildingTypeSchema } from '../schemas/schemas.building.js';
import { materialRequestSchema } from '../schemas/schemas.resources.js';

/**
 * The fields every android action carries.
 *
 * The length of `memory`, `recording` and a broadcast's `content` is a rule
 * rather than a schema constraint, so those ceilings are checked by the
 * mechanics that apply them — see `android.update-state` and `android.broadcast`.
 */
const androidSchema = z.object({
  androidId: idSchema,
  memory: z.string().optional(),
  recording: z.string().optional(),
});

const androidWaitEventSchema = androidSchema.extend({
  type: z.literal('android.wait'),
});

type AndroidWaitEvent = z.infer<typeof androidWaitEventSchema>;

const androidMoveEventSchema = androidSchema.extend({
  type: z.literal('android.move'),
  direction: directionSchema,
});

type AndroidMoveEvent = z.infer<typeof androidMoveEventSchema>;

const androidChargeEventSchema = androidSchema.extend({
  type: z.literal('android.charge'),
});

type AndroidChargeEvent = z.infer<typeof androidChargeEventSchema>;

const androidCollectEventSchema = androidSchema.extend({
  type: z.literal('android.collect'),
  resources: materialRequestSchema.optional(),
});

type AndroidCollectEvent = z.infer<typeof androidCollectEventSchema>;

const androidDepositEventSchema = androidSchema.extend({
  type: z.literal('android.deposit'),
  resources: materialRequestSchema.optional(),
});

type AndroidDepositEvent = z.infer<typeof androidDepositEventSchema>;

const androidWithdrawEventSchema = androidSchema.extend({
  type: z.literal('android.withdraw'),
  resources: materialRequestSchema,
});

type AndroidWithdrawEvent = z.infer<typeof androidWithdrawEventSchema>;

const androidStartConstructionEventSchema = androidSchema.extend({
  type: z.literal('android.start-construction'),
  buildingType: buildingTypeSchema,
  resources: materialRequestSchema.optional(),
});

type AndroidStartConstructionEvent = z.infer<typeof androidStartConstructionEventSchema>;

const androidContinueConstructionEventSchema = androidSchema.extend({
  type: z.literal('android.continue-construction'),
  resources: materialRequestSchema.optional(),
});

type AndroidContinueConstructionEvent = z.infer<typeof androidContinueConstructionEventSchema>;

const androidSalvageEventSchema = androidSchema.extend({
  type: z.literal('android.salvage'),
});

type AndroidSalvageEvent = z.infer<typeof androidSalvageEventSchema>;

const androidRepairEventSchema = androidSchema.extend({
  type: z.literal('android.repair'),
});

type AndroidRepairEvent = z.infer<typeof androidRepairEventSchema>;

const androidDismantleEventSchema = androidSchema.extend({
  type: z.literal('android.dismantle'),
  /**
   * Another android of the same owner to dismantle, which requires the acting
   * android to be on one of its owner's completed chargers. Omitted, the acting
   * android dismantles itself from wherever it stands.
   */
  targetAndroidId: idSchema.optional(),
});

type AndroidDismantleEvent = z.infer<typeof androidDismantleEventSchema>;

const androidLaunchEventSchema = androidSchema.extend({
  type: z.literal('android.launch'),
  scriptId: idSchema,
});

type AndroidLaunchEvent = z.infer<typeof androidLaunchEventSchema>;

const androidBroadcastEventSchema = androidSchema.extend({
  type: z.literal('android.broadcast'),
  content: z.string(),
});

type AndroidBroadcastEvent = z.infer<typeof androidBroadcastEventSchema>;

const androidCleanAcidEventSchema = androidSchema.extend({
  type: z.literal('android.clean-acid'),
  direction: directionSchema,
});

type AndroidCleanAcidEvent = z.infer<typeof androidCleanAcidEventSchema>;

const androidEventSchema = z.union([
  androidWaitEventSchema,
  androidMoveEventSchema,
  androidChargeEventSchema,
  androidCollectEventSchema,
  androidDepositEventSchema,
  androidWithdrawEventSchema,
  androidStartConstructionEventSchema,
  androidContinueConstructionEventSchema,
  androidSalvageEventSchema,
  androidRepairEventSchema,
  androidDismantleEventSchema,
  androidLaunchEventSchema,
  androidBroadcastEventSchema,
  androidCleanAcidEventSchema,
]);

type AndroidEvent = z.infer<typeof androidEventSchema>;

/**
 * `Omit` over a union collapses it to the keys every member shares, which for
 * android events is just `type`. Distributing keeps each variant's own fields.
 */
type WithoutAndroidId<T> = T extends unknown ? Omit<T, 'androidId'> : never;

/**
 * What a script returns: an event with the acting android left off.
 *
 * The engine stamps `androidId` on in {@link toAndroidEvent}, because a script
 * naming an android is a script naming *another* android. Player-facing, and
 * the type a TypeScript android annotates its turn function with.
 */
type AndroidAction = WithoutAndroidId<AndroidEvent>;

export type {
  AndroidAction,
  AndroidBroadcastEvent,
  AndroidChargeEvent,
  AndroidCleanAcidEvent,
  AndroidCollectEvent,
  AndroidContinueConstructionEvent,
  AndroidDepositEvent,
  AndroidDismantleEvent,
  AndroidEvent,
  AndroidLaunchEvent,
  AndroidMoveEvent,
  AndroidRepairEvent,
  AndroidSalvageEvent,
  AndroidStartConstructionEvent,
  AndroidWaitEvent,
  AndroidWithdrawEvent,
};
export {
  androidBroadcastEventSchema,
  androidChargeEventSchema,
  androidCleanAcidEventSchema,
  androidCollectEventSchema,
  androidContinueConstructionEventSchema,
  androidDepositEventSchema,
  androidDismantleEventSchema,
  androidEventSchema,
  androidLaunchEventSchema,
  androidMoveEventSchema,
  androidRepairEventSchema,
  androidSalvageEventSchema,
  androidStartConstructionEventSchema,
  androidWaitEventSchema,
  androidWithdrawEventSchema,
};
