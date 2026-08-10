import { z } from 'zod';

import { directionSchema, idSchema } from '../schemas/schemas.base.js';
import { androidMemoryLimit, androidRecordingLimit } from '../schemas/schemas.android.js';
import { buildingResourcesSchema, buildingTypeSchema } from '../schemas/schemas.building.js';

const androidSchema = z.object({
  androidId: idSchema,
  memory: z.string().max(androidMemoryLimit).optional(),
  recording: z.string().max(androidRecordingLimit).optional(),
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
  resources: buildingResourcesSchema.optional(),
});

type AndroidCollectEvent = z.infer<typeof androidCollectEventSchema>;

const androidDepositEventSchema = androidSchema.extend({
  type: z.literal('android.deposit'),
  resources: buildingResourcesSchema.optional(),
});

type AndroidDepositEvent = z.infer<typeof androidDepositEventSchema>;

const androidWithdrawEventSchema = androidSchema.extend({
  type: z.literal('android.withdraw'),
  resources: buildingResourcesSchema,
});

type AndroidWithdrawEvent = z.infer<typeof androidWithdrawEventSchema>;

const androidStartConstructionEventSchema = androidSchema.extend({
  type: z.literal('android.start-construction'),
  buildingType: buildingTypeSchema,
  resources: buildingResourcesSchema.optional(),
});

type AndroidStartConstructionEvent = z.infer<typeof androidStartConstructionEventSchema>;

const androidContinueConstructionEventSchema = androidSchema.extend({
  type: z.literal('android.continue-construction'),
  resources: buildingResourcesSchema.optional(),
});

type AndroidContinueConstructionEvent = z.infer<typeof androidContinueConstructionEventSchema>;

const androidSalvageEventSchema = androidSchema.extend({
  type: z.literal('android.salvage'),
});

type AndroidSalvageEvent = z.infer<typeof androidSalvageEventSchema>;

const androidDismantleEventSchema = androidSchema.extend({
  type: z.literal('android.dismantle'),
});

type AndroidDismantleEvent = z.infer<typeof androidDismantleEventSchema>;

const androidBroadcastEventSchema = androidSchema.extend({
  type: z.literal('android.broadcast'),
  content: z.string().max(256),
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
  androidDismantleEventSchema,
  androidBroadcastEventSchema,
  androidCleanAcidEventSchema,
]);

type AndroidEvent = z.infer<typeof androidEventSchema>;

export type {
  AndroidBroadcastEvent,
  AndroidChargeEvent,
  AndroidCleanAcidEvent,
  AndroidCollectEvent,
  AndroidContinueConstructionEvent,
  AndroidDepositEvent,
  AndroidDismantleEvent,
  AndroidEvent,
  AndroidMoveEvent,
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
  androidMoveEventSchema,
  androidSalvageEventSchema,
  androidStartConstructionEventSchema,
  androidWaitEventSchema,
  androidWithdrawEventSchema,
};
