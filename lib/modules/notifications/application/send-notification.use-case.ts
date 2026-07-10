import { prisma } from "@/lib/db";
import { NotificationKind } from "@prisma/client";
import { ReadDb, WriteTx } from "@/lib/modules/shared/db";

type Db = ReadDb | WriteTx;

export interface SendNotificationInput {
  userId: string;
  kind: NotificationKind;
  titlePl: string;
  titleEn: string;
  bodyPl: string;
  bodyEn: string;
  href?: string;
}

// WELCOME is a one-time onboarding message and is never gated by a preference toggle.
const PREFERENCE_FIELD_BY_KIND: Partial<Record<NotificationKind, "patronEnabled" | "commentEnabled" | "systemEnabled">> = {
  PATRON: "patronEnabled",
  COMMENT: "commentEnabled",
  SYSTEM: "systemEnabled",
  SUPPORT: "systemEnabled",
};

async function isNotificationAllowed(db: Db, userId: string, kind: NotificationKind): Promise<boolean> {
  const field = PREFERENCE_FIELD_BY_KIND[kind];
  if (!field) return true; // WELCOME or any kind without a gate

  const pref = await db.notificationPreference.findUnique({ where: { userId } });
  if (!pref) return true; // no row yet -> defaults are all-enabled
  return pref[field];
}

/**
 * Sends a notification unless the recipient has opted out of that category.
 * Pass `tx` to participate in an existing write transaction (e.g. patron grant flow);
 * omit it to run standalone (e.g. webhook handlers, comment likes).
 */
export async function sendNotification(input: SendNotificationInput, tx?: Db) {
  const db = tx ?? prisma;

  try {
    const allowed = await isNotificationAllowed(db, input.userId, input.kind);
    if (!allowed) return null;

    const override = await db.notificationTemplate.findUnique({ where: { kind: input.kind } });

    const notification = await db.notification.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        titlePl: override?.titlePl ?? input.titlePl,
        titleEn: override?.titleEn ?? input.titleEn,
        bodyPl: override?.bodyPl ?? input.bodyPl,
        bodyEn: override?.bodyEn ?? input.bodyEn,
        href: input.href,
      },
    });

    return notification;
  } catch (error) {
    console.error("[SEND_NOTIFICATION_ERROR]", error);
    // Notifications are best-effort side effects — never fail the caller's primary action.
    return null;
  }
}

// Hardcoded fallbacks, used whenever no NotificationTemplate override exists for the kind.
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
    bodyPl: "Twoje wsparcie jest dla nas bardzo ważne! Teraz masz dostęp do pełnej zawartości.",
    bodyEn: "Your support means everything to us! You now have access to all content.",
  },
  commentLike: {
    kind: "COMMENT" as NotificationKind,
    titlePl: "Twój komentarz polubiono",
    titleEn: "Your comment got a like",
    bodyPl: "Komuś spodobał się Twój komentarz.",
    bodyEn: "Someone liked your comment.",
  },
};
