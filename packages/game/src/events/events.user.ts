import { z } from 'zod';

import { idSchema } from '../schemas/schemas.base.js';

const launchAndroidEventSchema = z.object({
  type: z.literal('user.launch-android'),
  ownerId: idSchema,
  scriptId: idSchema,
});

type LaunchAndroidEvent = z.infer<typeof launchAndroidEventSchema>;

const uploadAndroidScriptEventSchema = z.object({
  type: z.literal('user.upload-android-script'),
  ownerId: idSchema,
  name: z.string(),
  content: z.string(),
});

type UploadAndroidScriptEvent = z.infer<typeof uploadAndroidScriptEventSchema>;

const dismantleAndroidEventSchema = z.object({
  type: z.literal('user.dismantle-android'),
  ownerId: idSchema,
  androidId: idSchema,
});

type DismantleAndroidEvent = z.infer<typeof dismantleAndroidEventSchema>;

const userEventSchema = z.union([
  launchAndroidEventSchema,
  uploadAndroidScriptEventSchema,
  dismantleAndroidEventSchema,
]);

type UserEvent = z.infer<typeof userEventSchema>;

export type { DismantleAndroidEvent, LaunchAndroidEvent, UploadAndroidScriptEvent, UserEvent };
export { dismantleAndroidEventSchema, launchAndroidEventSchema, uploadAndroidScriptEventSchema, userEventSchema };
