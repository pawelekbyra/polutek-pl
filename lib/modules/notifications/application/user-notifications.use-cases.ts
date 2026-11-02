import { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import {
  MarkNotificationsReadInput,
  UserNotificationDTO,
  UserNotificationPage,
  notificationLanguage,
  safeNotificationHref,
  userNotificationType,
  decodeUserNotificationCursor,
  encodeUserNotificationCursor,
  USER_NOTIFICATIONS_MAX_LIMIT,
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
  query: { limit: number; cursor?: string; unreadOnly?: boolean; language?: string; ids?: string[] },
): Promise<UserNotificationPage> {
  const userId = ownerId(ctx);
  if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > USER_NOTIFICATIONS_MAX_LIMIT) {
    throw new AppError("Invalid notification page size.", 400, "INVALID_REQUEST");
  }
  if (query.ids && (!query.ids.length || query.ids.length > 50 || query.ids.some((id) => id.length > 64))) throw new AppError("Invalid notification ids.", 400, "INVALID_REQUEST");
  const snapshotTime = ctx.now();
  const snapshotAt = snapshotTime.toISOString();
  let boundary = query.cursor ? decodeUserNotificationCursor(query.cursor) : null;
  if (query.cursor && !boundary) {
    // Accept old clients' id cursors, but never let another user's id reposition this feed.
    if (query.cursor.startsWith("v1:")) throw new AppError("Invalid notification cursor.", 400, "INVALID_CURSOR");
    boundary = await ctx.prisma.notification.findFirst({
      where: { id: query.cursor, userId }, select: { id: true, createdAt: true },
    });
    if (!boundary) throw new AppError("Invalid notification cursor.", 400, "INVALID_CURSOR");
  }
  const [user, rows, unreadCount] = await Promise.all([
    ctx.prisma.user.findUnique({ where: { id: userId }, select: { language: true } }),
    ctx.prisma.notification.findMany({
      where: {
        userId,
        ...(query.ids ? { id: { in: query.ids } } : {}),
        createdAt: { lte: snapshotTime },
        ...(!query.ids && query.unreadOnly ? { read: false } : {}),
        ...(boundary ? { OR: [{ createdAt: { lt: boundary.createdAt } }, { createdAt: boundary.createdAt, id: { lt: boundary.id } }] } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.ids ? 50 : query.limit + 1,
      select: { id: true, kind: true, titlePl: true, titleEn: true, bodyPl: true, bodyEn: true, templateKey: true, params: true, href: true, read: true, createdAt: true },
    }),
    ctx.prisma.notification.count({ where: { userId, read: false } }),
  ]);

  const language = notificationViewerLanguage(query.language ?? user?.language);
  const pl = notificationLanguage(language) === "pl";
  const page = query.ids ? rows : rows.slice(0, query.limit);
  const items: UserNotificationDTO[] = page.map((n) => {
    // Polish and English always read the stored text (as before); other languages use the keyed template when the
    // row has one, and fall back to the stored English text otherwise (old rows, unknown keys, statements of reasons).
    const rendered = pl || language === "en" ? null : renderNotification(n.templateKey, n.params, language);
    return {
      id: n.id,
      kind: n.kind,
      type: userNotificationType(n.kind, n.templateKey, n.params),
      title: rendered ? rendered.title : pl ? n.titlePl : n.titleEn,
      body: rendered ? rendered.body : pl ? n.bodyPl : n.bodyEn,
      href: safeNotificationHref(n.href),
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    };
  });
  return { items, nextCursor: !query.ids && rows.length > query.limit ? encodeUserNotificationCursor(page[page.length - 1]) : null, unreadCount, snapshotAt };
}

/** Marks one (`id`, which must be the caller's) or all unread notifications as read; idempotent. */
export async function markNotificationsRead(
  ctx: AppContext,
  input: MarkNotificationsReadInput,
): Promise<{ updated: number; unreadCount: number }> {
  const userId = ownerId(ctx);
  // A delayed mark-all request must not consume notifications that arrived after the displayed snapshot.
  const now = ctx.now();
  const before = "all" in input && input.before ? new Date(Math.min(Date.parse(input.before), now.getTime())) : now;
  const read = "all" in input || input.read !== false;
  const where = "all" in input ? { userId, read: false, createdAt: { lte: before } } : { id: input.id, userId, read: !read };
  const { count } = await ctx.prisma.notification.updateMany({ where, data: { read } });
  const unreadCount = await ctx.prisma.notification.count({ where: { userId, read: false } });
  return { updated: count, unreadCount };
}
