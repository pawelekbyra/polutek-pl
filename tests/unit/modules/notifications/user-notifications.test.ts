import { describe, expect, it, vi } from "vitest";
import {
  countUnreadNotifications,
  listUserNotifications,
  markNotificationsRead,
} from "@/lib/modules/notifications/application/user-notifications.use-cases";
import {
  listUserNotificationsQuerySchema,
  markNotificationsReadSchema,
  safeNotificationHref,
  userNotificationType,
  encodeUserNotificationCursor,
  decodeUserNotificationCursor,
} from "@/lib/modules/notifications/domain/user-notifications";

function ctxFor(actor: unknown, overrides: Record<string, unknown> = {}) {
  const notification = {
    count: vi.fn().mockResolvedValue(3),
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    ...overrides,
  };
  const prisma = { notification, user: { findUnique: vi.fn().mockResolvedValue({ language: "pl" }) } };
  return { ctx: { actor, prisma, now: () => new Date("2026-10-28T12:00:00Z") } as never, notification, prisma };
}
const user = { type: "user", userId: "me" };

const row = (id: string, href: string | null = "/watch/x") => ({
  id,
  kind: "NEW_VIDEO",
  titlePl: "Tytul",
  titleEn: "Title",
  bodyPl: "Tresc",
  bodyEn: "Body",
  href,
  read: false,
  createdAt: new Date("2026-10-14T10:00:00Z"),
});

describe("viewer notifications", () => {
  it("counts only the caller's unread rows", async () => {
    const { ctx, notification } = ctxFor(user);
    expect(await countUnreadNotifications(ctx)).toBe(3);
    expect(notification.count).toHaveBeenCalledWith({ where: { userId: "me", read: false } });
  });

  it("rejects guests", async () => {
    const { ctx } = ctxFor({ type: "guest" });
    await expect(countUnreadNotifications(ctx)).rejects.toMatchObject({ statusCode: 401 });
    await expect(listUserNotifications(ctx, { limit: 10 })).rejects.toMatchObject({ statusCode: 401 });
    await expect(markNotificationsRead(ctx, { all: true })).rejects.toMatchObject({ statusCode: 401 });
  });

  it("lists own rows paged, in the account language, with a cursor", async () => {
    const { ctx, notification } = ctxFor(user, { findMany: vi.fn().mockResolvedValue([row("a"), row("b"), row("c")]) });
    const page = await listUserNotifications(ctx, { limit: 2 });
    expect(notification.findMany.mock.calls[0][0].where).toEqual({ userId: "me", createdAt: { lte: new Date("2026-10-28T12:00:00Z") } });
    expect(notification.findMany.mock.calls[0][0].take).toBe(3);
    expect(page.items.map((n) => n.id)).toEqual(["a", "b"]);
    expect(page.items[0].title).toBe("Tytul");
    expect(page.nextCursor).toBe(encodeUserNotificationCursor(row("b")));
    expect(page.snapshotAt).toBe("2026-10-28T12:00:00.000Z");
    expect(page.items[0].type).toBe("new_video");
    expect(page.unreadCount).toBe(3);
  });

  it("uses English for non-Polish accounts and filters unread when asked", async () => {
    const { ctx, prisma, notification } = ctxFor(user, { findMany: vi.fn().mockResolvedValue([row("a")]) });
    prisma.user.findUnique.mockResolvedValue({ language: "de" });
    const page = await listUserNotifications(ctx, { limit: 5, unreadOnly: true });
    expect(page.items[0].title).toBe("Title");
    expect(page.nextCursor).toBeNull();
    expect(notification.findMany.mock.calls[0][0].where).toEqual({ userId: "me", read: false, createdAt: { lte: new Date("2026-10-28T12:00:00Z") } });
  });

  it("renders keyed rows in the account language and falls back to stored text otherwise", async () => {
    const keyed = { ...row("k"), templateKey: "new_video", params: { channelName: "Kanał", title: "Film", titleEn: "Movie" } };
    const unknown = { ...row("u"), templateKey: "gone", params: {} };
    const noParams = { ...row("n"), templateKey: "new_video", params: null };
    const old = { ...row("o"), templateKey: null, params: null };
    const { ctx, prisma } = ctxFor(user, { findMany: vi.fn().mockResolvedValue([keyed, unknown, noParams, old]) });

    prisma.user.findUnique.mockResolvedValue({ language: "de" });
    const de = await listUserNotifications(ctx, { limit: 10 });
    expect(de.items[0]).toMatchObject({ title: "Neues Video: Kanał", body: "Movie" });
    for (const item of de.items.slice(1)) expect(item).toMatchObject({ title: "Title", body: "Body" });

    prisma.user.findUnique.mockResolvedValue({ language: "zh" });
    expect((await listUserNotifications(ctx, { limit: 10 })).items[0].title).toBe("新视频：Kanał");

    // Polish and English keep reading the stored text exactly as before.
    prisma.user.findUnique.mockResolvedValue({ language: "pl" });
    expect((await listUserNotifications(ctx, { limit: 10 })).items[0]).toMatchObject({ title: "Tytul", body: "Tresc" });
    prisma.user.findUnique.mockResolvedValue({ language: "en" });
    expect((await listUserNotifications(ctx, { limit: 10 })).items[0]).toMatchObject({ title: "Title", body: "Body" });
    // An unsupported account language reads English.
    prisma.user.findUnique.mockResolvedValue({ language: "ru" });
    expect((await listUserNotifications(ctx, { limit: 10 })).items[0]).toMatchObject({ title: "Title" });
  });

  it("drops unsafe links", async () => {
    const { ctx } = ctxFor(user, { findMany: vi.fn().mockResolvedValue([row("a", "javascript:alert(1)")]) });
    expect((await listUserNotifications(ctx, { limit: 5 })).items[0].href).toBeNull();
    expect(safeNotificationHref("//evil.example")).toBeNull();
    expect(safeNotificationHref("/pl/watch/x")).toBe("/pl/watch/x");
    expect(safeNotificationHref("https://ok.example/a")).toBe("https://ok.example/a");
  });

  it("marks one row read only within the caller's own rows", async () => {
    const { ctx, notification } = ctxFor(user);
    await markNotificationsRead(ctx, { id: "n1" });
    expect(notification.updateMany).toHaveBeenCalledWith({ where: { id: "n1", userId: "me", read: false }, data: { read: true } });
  });

  it("marks all of the caller's unread rows read", async () => {
    const { ctx, notification } = ctxFor(user);
    const result = await markNotificationsRead(ctx, { all: true });
    expect(notification.updateMany).toHaveBeenCalledWith({ where: { userId: "me", read: false, createdAt: { lte: new Date("2026-10-28T12:00:00Z") } }, data: { read: true } });
    expect(result).toEqual({ updated: 1, unreadCount: 3 });
  });

  it("uses a stable keyset after a boundary notification was removed, including equal timestamps", async () => {
    const boundary = row("b");
    const cursor = encodeUserNotificationCursor(boundary);
    expect(decodeUserNotificationCursor(cursor)).toEqual({ id: "b", createdAt: boundary.createdAt });
    const { ctx, notification } = ctxFor(user);
    await listUserNotifications(ctx, { limit: 2, cursor });
    expect(notification.findFirst).not.toHaveBeenCalled();
    expect(notification.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      userId: "me", createdAt: { lte: new Date("2026-10-28T12:00:00Z") }, OR: [{ createdAt: { lt: boundary.createdAt } }, { createdAt: boundary.createdAt, id: { lt: "b" } }],
    } }));
    expect(notification.findMany.mock.calls[0][0]).not.toHaveProperty("cursor");
  });

  it("supports own legacy cursors but refuses foreign, missing and malformed cursors", async () => {
    const { ctx, notification } = ctxFor(user);
    notification.findFirst.mockResolvedValueOnce({ id: "old", createdAt: row("old").createdAt });
    await listUserNotifications(ctx, { limit: 2, cursor: "old" });
    expect(notification.findFirst).toHaveBeenCalledWith({ where: { id: "old", userId: "me" }, select: { id: true, createdAt: true } });
    for (const cursor of ["foreign", "deleted", "v1:bad", "v1:9999999999999999:n1"]) {
      await expect(listUserNotifications(ctx, { limit: 2, cursor })).rejects.toMatchObject({ statusCode: 400, code: "INVALID_CURSOR" });
    }
  });

  it("bounds rows to the same pre-query snapshot used by mark-all while counting every unread arrival", async () => {
    const { ctx, notification } = ctxFor(user);
    const page = await listUserNotifications(ctx, { limit: 10 });
    expect(notification.findMany.mock.calls[0][0].where.createdAt).toEqual({ lte: new Date(page.snapshotAt) });
    expect(notification.count).toHaveBeenCalledWith({ where: { userId: "me", read: false } });
    await markNotificationsRead(ctx, { all: true, before: page.snapshotAt });
    expect(notification.updateMany.mock.calls[0][0].where.createdAt).toEqual(notification.findMany.mock.calls[0][0].where.createdAt);
  });

  it("does not mark arrivals after the displayed snapshot read and clamps future cutoffs to the server clock", async () => {
    const { ctx, notification } = ctxFor(user);
    await markNotificationsRead(ctx, { all: true, before: "2026-10-28T11:59:00.000Z" });
    expect(notification.updateMany).toHaveBeenLastCalledWith({ where: { userId: "me", read: false, createdAt: { lte: new Date("2026-10-28T11:59:00Z") } }, data: { read: true } });
    await markNotificationsRead(ctx, { all: true, before: "2027-01-01T00:00:00.000Z" });
    expect(notification.updateMany).toHaveBeenLastCalledWith({ where: { userId: "me", read: false, createdAt: { lte: new Date("2026-10-28T12:00:00Z") } }, data: { read: true } });
  });

  it("rejects browser-normalized and encoded redirect tricks, bad ports and malformed URLs", () => {
    for (const href of ["/\\evil.example", "/%2Fevil.example", "/%5cevil.example", "/%252fevil.example", "/%250a/evil.example", "/\tevil.example", "/bad%escape", "https://ok.example:99999/", "https://user:password@ok.example/", "https://", "https:///", "https://ok.example/\\evil"]) {
      expect(safeNotificationHref(href), href).toBeNull();
    }
    expect(safeNotificationHref("/watch/film#comment-abc")).toBe("/watch/film#comment-abc");
    expect(safeNotificationHref("https://ok.example:8443/path?q=1#here")).toBe("https://ok.example:8443/path?q=1#here");
  });

  it("derives event types independently of translated text and ignores keys of another kind", () => {
    const cases = [["COMMENT", "creator_like", "creator_like"], ["COMMENT", "comment_like", "comment_like"], ["COMMENT", "comment_reply", "comment_reply"], ["NEW_VIDEO", "premiere", "premiere"], ["NEW_VIDEO", null, "new_video"], ["WELCOME", null, "welcome"], ["PATRON", null, "support"], ["SUPPORT", null, "support"], ["MODERATION", null, "moderation"], ["SYSTEM", null, "announcement"], ["SYSTEM", "creator_like", "announcement"]] as const;
    for (const [kind, key, expected] of cases) expect(userNotificationType(kind, key)).toBe(expected);
  });

  it("validates query and body", () => {
    expect(listUserNotificationsQuerySchema.parse({}).limit).toBe(20);
    expect(listUserNotificationsQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
    expect(markNotificationsReadSchema.safeParse({ id: "a", all: true }).success).toBe(false);
    expect(markNotificationsReadSchema.safeParse({}).success).toBe(false);
    expect(markNotificationsReadSchema.safeParse({ all: true }).success).toBe(true);
    expect(markNotificationsReadSchema.safeParse({ all: true, before: "bad" }).success).toBe(false);
    expect(markNotificationsReadSchema.safeParse({ all: true, before: "2026-10-28T12:00:00.000Z" }).success).toBe(true);
  });
});
