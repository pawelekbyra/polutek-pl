import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NotificationPreferencesDTO,
  UpdateNotificationPreferencesInput,
} from "../domain/notification-preferences";

function ownerId(ctx: AppContext): string {
  const { actor } = ctx;
  if (actor.type === "user" || actor.type === "admin") return actor.userId;
  throw new AppError("Sign in to manage notifications.", 401, "UNAUTHORIZED");
}

export async function getNotificationPreferences(ctx: AppContext): Promise<NotificationPreferencesDTO> {
  const userId = ownerId(ctx);
  const [pref, mail] = await Promise.all([
    ctx.prisma.notificationPreference.findUnique({ where: { userId } }),
    ctx.prisma.emailPreference.findUnique({ where: { userId }, select: { marketingEmails: true } }),
  ]);
  return {
    newVideoInApp: pref?.newVideoInApp ?? DEFAULT_NOTIFICATION_PREFERENCES.newVideoInApp,
    newVideoEmail: pref?.newVideoEmail ?? DEFAULT_NOTIFICATION_PREFERENCES.newVideoEmail,
    commentEnabled: pref?.commentEnabled ?? DEFAULT_NOTIFICATION_PREFERENCES.commentEnabled,
    systemEnabled: pref?.systemEnabled ?? DEFAULT_NOTIFICATION_PREFERENCES.systemEnabled,
    emailConsent: mail?.marketingEmails === true,
  };
}

/**
 * Saves the given toggles (the input is already validated by `updateNotificationPreferencesSchema`)
 * and returns the full state. Never touches the content-mail consent: that is only changed by the
 * subscribe and unsubscribe flows.
 */
export async function updateNotificationPreferences(
  ctx: AppContext,
  input: UpdateNotificationPreferencesInput,
): Promise<NotificationPreferencesDTO> {
  const userId = ownerId(ctx);
  const data = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as UpdateNotificationPreferencesInput;
  await ctx.prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
  return getNotificationPreferences(ctx);
}
