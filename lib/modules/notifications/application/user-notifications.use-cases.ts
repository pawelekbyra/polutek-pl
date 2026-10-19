import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import {
  MarkNotificationsReadInput,
  UserNotificationDTO,
  UserNotificationPage,
  notificationLanguage,
  safeNotificationHref,
} from "../domain/user-notifications";
import { notificationViewerLanguage, renderNotification } from "../domain/notification-render";

/** The signed-in viewer's notification feed. Only ever the caller's own rows (the user id comes from the actor). */

function ownerId(ctx: AppContext): string {
  const { actor } = ctx;
  if (actor.type === "user" || actor.type === "admin") return actor.userId;
  throw new AppError("Sign in to see notifications.", 401, "UNAUTHORIZED");
}

export async function countUnreadNotifications(ctx: AppContext): Promise<number> {
  return ctx.prisma.notification.count({ where: { userId: ownerId(ctx), read: false } });
}

export async function listUserNotifications(
  ctx: AppContext,
  query: { limit: number; cursor?: string; unreadOnly?: boolean },
): Promise<UserNotificationPage> {
  const userId = ownerId(ctx);
  const [user, rows, unreadCount] = await Promise.all([
    ctx.prisma.user.findUnique({ where: { id: userId }, select: { language: true } }),
    ctx.prisma.notification.findMany({
      where: { userId, ...(query.unreadOnly ? { read: false } : {}) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      // A cursor id that is not the caller's only repositions inside the caller's own rows.
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: { id: true, kind: true, titlePl: true, titleEn: true, bodyPl: true, bodyEn: true, templateKey: true, params: true, href: true, read: true, createdAt: true },
    }),
    ctx.prisma.notification.count({ where: { userId, read: false } }),
  ]);

  const pl = notificationLanguage(user?.language) === "pl";
  const language = notificationViewerLanguage(user?.language);
  const page = rows.slice(0, query.limit);
  const items: UserNotificationDTO[] = page.map((n) => {
    // Polish and English always read the stored text (as before); other languages use the keyed template when the
    // row has one, and fall back to the stored English text otherwise (old rows, unknown keys, statements of reasons).
    const rendered = pl || language === "en" ? null : renderNotification(n.templateKey, n.params, language);
    return {
      id: n.id,
      kind: n.kind,
      title: rendered ? rendered.title : pl ? n.titlePl : n.titleEn,
      body: rendered ? rendered.body : pl ? n.bodyPl : n.bodyEn,
      href: safeNotificationHref(n.href),
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    };
  });
  return { items, nextCursor: rows.length > query.limit ? page[page.length - 1].id : null, unreadCount };
}

/** Marks one (`id`, which must be the caller's) or all unread notifications as read; idempotent. */
export async function markNotificationsRead(
  ctx: AppContext,
  input: MarkNotificationsReadInput,
): Promise<{ updated: number; unreadCount: number }> {
  const userId = ownerId(ctx);
  const where = "all" in input ? { userId, read: false } : { id: input.id, userId, read: false };
  const { count } = await ctx.prisma.notification.updateMany({ where, data: { read: true } });
  const unreadCount = await ctx.prisma.notification.count({ where: { userId, read: false } });
  return { updated: count, unreadCount };
}
