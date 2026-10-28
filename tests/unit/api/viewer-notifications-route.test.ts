import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AppError } from "@/lib/modules/shared/app-error";

const m = vi.hoisted(() => ({
  auth: vi.fn(), rate: vi.fn(), list: vi.fn(), mark: vi.fn(), count: vi.fn(), context: { actor: { type: "user", userId: "me" } },
}));
vi.mock("@/lib/api/auth", () => ({ getActorFromAuth: m.auth }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.rate }));
vi.mock("@/lib/modules/shared/app-context", () => ({ createAppContext: () => m.context }));
vi.mock("@/lib/modules/notifications", async () => ({
  ...(await vi.importActual("@/lib/modules/notifications/domain/user-notifications")),
  listUserNotifications: m.list, markNotificationsRead: m.mark, countUnreadNotifications: m.count,
}));

const { GET: list } = await import("@/app/api/user/notifications/route");
const { POST: mark } = await import("@/app/api/user/notifications/read/route");
const { GET: count } = await import("@/app/api/user/notifications/unread-count/route");
const req = (query = "") => new NextRequest(`https://www.pawelperfect.com/api/user/notifications${query}`);
const write = (body: unknown) => new NextRequest("https://www.pawelperfect.com/api/user/notifications/read", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ type: "user", userId: "me" });
  m.rate.mockResolvedValue({ success: true, remaining: 20 });
  m.list.mockResolvedValue({ items: [], nextCursor: null, unreadCount: 0, snapshotAt: "2026-10-28T12:00:00.000Z" });
  m.mark.mockResolvedValue({ updated: 1, unreadCount: 2 });
  m.count.mockResolvedValue(2);
});

describe("viewer notification API", () => {
  it("rejects guests on all three routes before touching notification data", async () => {
    m.auth.mockResolvedValue({ type: "guest" });
    for (const response of [await list(req()), await mark(write({ all: true })), await count()]) {
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
    expect(m.list).not.toHaveBeenCalled();
    expect(m.mark).not.toHaveBeenCalled();
    expect(m.count).not.toHaveBeenCalled();
  });

  it("never caches server failures on any notification route", async () => {
    const cases = [
      { handler: () => list(req()), operation: m.list },
      { handler: () => mark(write({ all: true })), operation: m.mark },
      { handler: () => count(), operation: m.count },
    ];
    for (const { handler, operation } of cases) {
      operation.mockRejectedValueOnce(new Error("Database unavailable"));
      const response = await handler();
      expect(response.status).toBe(500);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
    const invalid = await list(req("?limit=1000"));
    expect(invalid.status).toBe(400);
    expect(invalid.headers.get("cache-control")).toBe("private, no-store");
  });

  it("uses per-viewer rate limits and returns a non-cacheable retry response", async () => {
    m.rate.mockResolvedValue({ success: false, remaining: 0 });
    const response = await list(req());
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(m.rate).toHaveBeenCalledWith(expect.objectContaining({ key: "viewer-notifications:read:me", limit: 240 }));
    expect(m.list).not.toHaveBeenCalled();
  });

  it("passes only the validated cursor/filter/page size and keeps viewer data private", async () => {
    const response = await list(req("?limit=10&cursor=v1%3A1793188800000%3An1&unread=1"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(m.list).toHaveBeenCalledWith(m.context, { limit: 10, cursor: "v1:1793188800000:n1", unreadOnly: true });
    expect(await response.json()).toMatchObject({ snapshotAt: "2026-10-28T12:00:00.000Z" });
    expect((await list(req("?limit=1000"))).status).toBe(400);
  });

  it("accepts the mark-all snapshot cutoff and rejects another account or an invalid timestamp", async () => {
    const payload = { all: true, before: "2026-10-28T12:00:00.000Z" };
    const response = await mark(write(payload));
    expect(response.status).toBe(200);
    expect(m.mark).toHaveBeenCalledWith(m.context, payload);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await mark(write({ ...payload, userId: "other" }))).status).toBe(400);
    expect((await mark(write({ all: true, before: "yesterday" }))).status).toBe(400);
  });

  it("returns the private unread count and safely reports invalid cursors", async () => {
    const response = await count();
    expect(await response.json()).toEqual({ unreadCount: 2 });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    m.list.mockRejectedValueOnce(new AppError("Invalid notification cursor.", 400, "INVALID_CURSOR"));
    expect((await list(req("?cursor=foreign-id"))).status).toBe(400);
  });
});
