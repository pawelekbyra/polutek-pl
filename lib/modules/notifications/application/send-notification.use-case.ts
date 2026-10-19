import { prisma } from "@/lib/prisma";
import { NotificationKind } from "@prisma/client";
import { ReadDb, WriteTx } from "@/lib/modules/shared/db";
import type { NotificationParams, NotificationTemplateKey } from "../domain/notification-render";

type Db = ReadDb | WriteTx;

export interface SendNotificationInput {
  userId: string;
  kind: NotificationKind;
  titlePl: string;
  titleEn: string;
  bodyPl: string;
  bodyEn: string;
  /**
   * Template key + placeholder values: lets the bell show the notification in any UI language. The pl/en text above
   * stays the fallback. Dropped when an admin template override replaces the text (the override is static text).
   */
  templateKey?: NotificationTemplateKey;
  params?: NotificationParams;
  href?: string;
  /** Channel and video the notification is about (NEW_VIDEO, MODERATION). */
  channelId?: string;
  videoId?: string;
  /** Deliver even when the recipient switched this category off (decisions that restrict a channel, DSA art. 17). */
  force?: boolean;
  /** Use the given text as is, never an admin-edited template (the text carries the statement of reasons). */
  skipTemplate?: boolean;
}

// WELCOME is a one-time onboarding message and is never gated by a preference toggle.
const PREFERENCE_FIELD_BY_KIND: Partial<
  Record<NotificationKind, "patronEnabled" | "commentEnabled" | "systemEnabled" | "newVideoInApp" | "moderationEnabled">
> = {
  PATRON: "patronEnabled",
  COMMENT: "commentEnabled",
  SYSTEM: "systemEnabled",
  SUPPORT: "systemEnabled",
  NEW_VIDEO: "newVideoInApp",
  MODERATION: "moderationEnabled",
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
    const allowed = input.force === true || (await isNotificationAllowed(db, input.userId, input.kind));
    if (!allowed) return null;

    const override = input.skipTemplate ? null : await db.notificationTemplate.findUnique({ where: { kind: input.kind } });

    const notification = await db.notification.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        titlePl: override?.titlePl ?? input.titlePl,
        titleEn: override?.titleEn ?? input.titleEn,
        bodyPl: override?.bodyPl ?? input.bodyPl,
        bodyEn: override?.bodyEn ?? input.bodyEn,
        href: input.href,
        ...(input.templateKey && !override ? { templateKey: input.templateKey, params: input.params ?? {} } : {}),
        ...(input.channelId ? { channelId: input.channelId } : {}),
        ...(input.videoId ? { videoId: input.videoId } : {}),
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
    templateKey: "welcome" as NotificationTemplateKey,
    titlePl: "Witaj!",
    titleEn: "Welcome!",
    bodyPl: "Dziękujemy za dołączenie! Wszystkie filmy są dostępne po zalogowaniu.",
    bodyEn: "Thank you for joining! Every video is available once you are signed in.",
  },
  // A tip is a voluntary gift that unlocks nothing (Regulamin §4): thanks only, no promise of access.
  supportThanks: {
    kind: "PATRON" as NotificationKind,
    templateKey: "support_thanks" as NotificationTemplateKey,
    titlePl: "Dziękuję za wsparcie!",
    titleEn: "Thank you for your support!",
    bodyPl: "Twój napiwek dotarł. Dziękuję, to dla mnie wiele znaczy.",
    bodyEn: "Your tip has arrived. Thank you, it means a lot to me.",
  },
  // Somebody answered the recipient's comment (the body is "name: start of the reply", built per notification).
  commentReply: {
    kind: "COMMENT" as NotificationKind,
    templateKey: "comment_reply" as NotificationTemplateKey,
    titlePl: "Nowa odpowiedź na Twój komentarz",
    titleEn: "New reply to your comment",
    bodyPl: "Ktoś odpowiedział na Twój komentarz.",
    bodyEn: "Someone replied to your comment.",
  },
  // The channel's creator liked or hearted the recipient's comment.
  creatorLike: {
    kind: "COMMENT" as NotificationKind,
    templateKey: "creator_like" as NotificationTemplateKey,
    titlePl: "Twórca polubił Twój komentarz",
    titleEn: "The creator liked your comment",
    bodyPl: "Twórca kanału docenił Twój komentarz.",
    bodyEn: "The channel's creator appreciated your comment.",
  },
  commentLike: {
    kind: "COMMENT" as NotificationKind,
    templateKey: "comment_like" as NotificationTemplateKey,
    titlePl: "Twój komentarz polubiono",
    titleEn: "Your comment got a like",
    bodyPl: "Komuś spodobał się Twój komentarz.",
    bodyEn: "Someone liked your comment.",
  },
};
