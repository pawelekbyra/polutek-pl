import { z } from "zod";

/** A channel id (`Creator.id`): uuid or cuid style, nothing else reaches the database. */
export const channelIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

/** Body or query of POST, DELETE and GET /api/subscriptions. No creatorId = the main channel (back-compat). */
export const subscriptionTargetSchema = z
  .object({ creatorId: channelIdSchema.optional() })
  .strict();

/** Body of PATCH /api/subscriptions: the bell of one subscription. */
export const subscriptionNotifySchema = z
  .object({ creatorId: channelIdSchema.optional(), notify: z.boolean() })
  .strict();

export type SubscriptionTargetInput = z.infer<typeof subscriptionTargetSchema>;
export type SubscriptionNotifyInput = z.infer<typeof subscriptionNotifySchema>;
