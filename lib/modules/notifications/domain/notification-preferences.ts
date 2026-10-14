import { z } from "zod";

/**
 * The viewer-editable part of `NotificationPreference`. `patronEnabled` and `moderationEnabled` are
 * deliberately not here: tip thanks and decisions about the viewer's own channel are not a
 * "category to mute" in this screen. `newVideoEmail` is not here either: e-mail about new videos is
 * a later step, so the field is neither shown nor writable.
 */
export const NOTIFICATION_PREFERENCE_FIELDS = ["newVideoInApp", "commentEnabled", "systemEnabled"] as const;
export type NotificationPreferenceField = (typeof NOTIFICATION_PREFERENCE_FIELDS)[number];

/** Strict: an unknown key (for example `userId`) is a 400, never silently written. At least one toggle is required. */
export const updateNotificationPreferencesSchema = z
  .object({
    newVideoInApp: z.boolean().optional(),
    commentEnabled: z.boolean().optional(),
    systemEnabled: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((v) => v !== undefined), { message: "At least one preference is required." });
export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesSchema>;

export interface NotificationPreferencesDTO {
  newVideoInApp: boolean;
  commentEnabled: boolean;
  systemEnabled: boolean;
}

/** No stored row means every toggle is on (the schema defaults). */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferencesDTO = {
  newVideoInApp: true,
  commentEnabled: true,
  systemEnabled: true,
};
