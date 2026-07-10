import { prisma } from "@/lib/prisma";
import { NotificationPreferencesDTO } from "../domain/notification.dto";

const DEFAULTS: NotificationPreferencesDTO = {
  patronEnabled: true,
  commentEnabled: true,
  systemEnabled: true,
};

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferencesDTO> {
  const pref = await prisma.notificationPreference.findUnique({ where: { userId } });
  return {
    patronEnabled: pref?.patronEnabled ?? DEFAULTS.patronEnabled,
    commentEnabled: pref?.commentEnabled ?? DEFAULTS.commentEnabled,
    systemEnabled: pref?.systemEnabled ?? DEFAULTS.systemEnabled,
  };
}

export async function updateNotificationPreferences(
  userId: string,
  patch: Partial<NotificationPreferencesDTO>,
): Promise<NotificationPreferencesDTO> {
  const pref = await prisma.notificationPreference.upsert({
    where: { userId },
    create: {
      userId,
      patronEnabled: patch.patronEnabled ?? DEFAULTS.patronEnabled,
      commentEnabled: patch.commentEnabled ?? DEFAULTS.commentEnabled,
      systemEnabled: patch.systemEnabled ?? DEFAULTS.systemEnabled,
    },
    update: {
      ...(patch.patronEnabled !== undefined && { patronEnabled: patch.patronEnabled }),
      ...(patch.commentEnabled !== undefined && { commentEnabled: patch.commentEnabled }),
      ...(patch.systemEnabled !== undefined && { systemEnabled: patch.systemEnabled }),
    },
  });

  return {
    patronEnabled: pref.patronEnabled,
    commentEnabled: pref.commentEnabled,
    systemEnabled: pref.systemEnabled,
  };
}
