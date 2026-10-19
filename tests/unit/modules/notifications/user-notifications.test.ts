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
} from "@/lib/modules/notifications/domain/user-notifications";

function ctxFor(actor: unknown, overrides: Record<string, unknown> = {}) {
  const notification = {
    count: vi.fn().mockResolvedValue(3),
    findMany: vi.fn().mockResolvedValue([]),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    ...overrides,
  };
  const prisma = { notification, user: { findUnique: vi.fn().mockResolvedValue({ language: "pl" }) } };
  return { ctx: { actor, prisma } as never, notification, prisma };
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
    expect(notification.findMany.mock.calls[0][0].where).toEqual({ userId: "me" });
    expect(notification.findMany.mock.calls[0][0].take).toBe(3);
    expect(page.items.map((n) => n.id)).toEqual(["a", "b"]);
    expect(page.items[0].title).toBe("Tytul");
    expect(page.nextCursor).toBe("b");
    expect(page.unreadCount).toBe(3);
  });

  it("uses English for non-Polish accounts and filters unread when asked", async () => {
    const { ctx, prisma, notification } = ctxFor(user, { findMany: vi.fn().mockResolvedValue([row("a")]) });
    prisma.user.findUnique.mockResolvedValue({ language: "de" });
    const page = await listUserNotifications(ctx, { limit: 5, unreadOnly: true });
    expect(page.items[0].title).toBe("Title");
    expect(page.nextCursor).toBeNull();
    expect(notification.findMany.mock.calls[0][0].where).toEqual({ userId: "me", read: false });
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
    expect(notification.updateMany).toHaveBeenCalledWith({ where: { userId: "me", read: false }, data: { read: true } });
    expect(result).toEqual({ updated: 1, unreadCount: 3 });
  });

  it("validates query and body", () => {
    expect(listUserNotificationsQuerySchema.parse({}).limit).toBe(20);
    expect(listUserNotificationsQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
    expect(markNotificationsReadSchema.safeParse({ id: "a", all: true }).success).toBe(false);
    expect(markNotificationsReadSchema.safeParse({}).success).toBe(false);
    expect(markNotificationsReadSchema.safeParse({ all: true }).success).toBe(true);
  });
});
