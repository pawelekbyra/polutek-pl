import { z } from "zod";

/**
 * The viewer-editable part of `NotificationPreference`. `patronEnabled` and `moderationEnabled` are
 * deliberately not here: tip thanks and decisions about the viewer's own channel are not a
 * "category to mute" in this screen.
 */
export const NOTIFICATION_PREFERENCE_FIELDS = ["newVideoInApp", "newVideoEmail", "commentEnabled", "systemEnabled"] as const;
export type NotificationPreferenceField = (typeof NOTIFICATION_PREFERENCE_FIELDS)[number];

/** Strict: an unknown key (for example `userId`) is a 400, never silently written. At least one toggle is required. */
export const updateNotificationPreferencesSchema = z
  .object({
    newVideoInApp: z.boolean().optional(),
    newVideoEmail: z.boolean().optional(),
    commentEnabled: z.boolean().optional(),
    systemEnabled: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((v) => v !== undefined), { message: "At least one preference is required." });
export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesSchema>;

export interface NotificationPreferencesDTO {
  newVideoInApp: boolean;
  newVideoEmail: boolean;
  commentEnabled: boolean;
  systemEnabled: boolean;
  /**
   * Read-only: the account has consented to content e-mail (`EmailPreference.marketingEmails`). The
   * new-video mail is sent only with it; it is given and withdrawn with the subscribe / unsubscribe flow.
   */
  emailConsent: boolean;
}

/** No stored row means every toggle is on (the schema defaults). */
export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<NotificationPreferencesDTO, "emailConsent"> = {
  newVideoInApp: true,
  newVideoEmail: true,
  commentEnabled: true,
  systemEnabled: true,
};
