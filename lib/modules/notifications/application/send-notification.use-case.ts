import { prisma } from "@/lib/db";
import { NotificationKind } from "@prisma/client";

export interface SendNotificationInput {
  userId: string;
  kind: NotificationKind;
  titlePl: string;
  titleEn: string;
  bodyPl: string;
  bodyEn: string;
  href?: string;
}

export async function sendNotification(input: SendNotificationInput) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        titlePl: input.titlePl,
        titleEn: input.titleEn,
        bodyPl: input.bodyPl,
        bodyEn: input.bodyEn,
        href: input.href,
      },
    });

    return notification;
  } catch (error) {
    console.error("[SEND_NOTIFICATION_ERROR]", error);
    throw error;
  }
}

// Predefined notification templates
export const notificationTemplates = {
  welcome: {
    kind: "WELCOME" as NotificationKind,
    titlePl: "Witaj!",
    titleEn: "Welcome!",
    bodyPl: "Dziękujemy za dołączenie! Odkryj naszą zawartość i dołącz do społeczności patronów.",
    bodyEn: "Thank you for joining! Discover our content and join our patron community.",
  },
  patronAccess: {
    kind: "PATRON" as NotificationKind,
    titlePl: "Witaj, Patronie!",
    titleEn: "Welcome, Patron!",
    bodyPl: "Twoja poparcie jest dla nas bardzo ważne! Teraz masz dostęp do pełnej zawartości.",
    bodyEn: "Your support means everything to us! You now have access to all content.",
  },
  commentLike: (commenterName: string) => ({
    kind: "COMMENT" as NotificationKind,
    titlePl: "Twój komentarz polubił się",
    titleEn: "Your comment got a like",
    bodyPl: `Komuś spodobał się Twój komentarz`,
    bodyEn: `Someone liked your comment`,
  }),
};
