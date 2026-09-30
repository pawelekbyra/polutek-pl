import { describe, expect, it, vi } from "vitest";
import {
  ADMIN_DEFAULT_GET_LIMIT,
  ADMIN_RATE_LIMIT_TIMEOUT_MS,
  checkAdminRateLimit,
  getAdminClientIp,
  resolveAdminRateBucket,
} from "@/lib/api/admin-rate-limit";

describe("resolveAdminRateBucket", () => {
  it.each([
    ["/api/admin/payments/abc/refund", "POST", "payments-refund", 5],
    ["/api/admin/payments/abc/dispute-sync", "POST", "payments-dispute-sync", 5],
    ["/api/admin/emails/broadcast", "POST", "emails-broadcast", 3],
    ["/api/admin/notifications/broadcast", "POST", "notifications-broadcast", 3],
    ["/api/admin/users/u1/patron", "PATCH", "users-patron", 10],
    ["/api/admin/payment-settings", "PATCH", "payment-settings", 10],
    ["/api/admin/payment-settings", "PUT", "payment-settings", 10],
    ["/api/admin/comments/c1/hide", "POST", "mutation", 120],
    ["/api/admin/videos", "DELETE", "mutation", 120],
    ["/api/admin/videos", "GET", "read", ADMIN_DEFAULT_GET_LIMIT],
    ["/api/admin/payment-settings", "GET", "read", ADMIN_DEFAULT_GET_LIMIT],
    ["/api/admin/emails/broadcast", "GET", "read", ADMIN_DEFAULT_GET_LIMIT],
  ])("%s %s -> %s (%i/min)", (pathname, method, bucket, limit) => {
    expect(resolveAdminRateBucket(pathname, method)).toEqual({ bucket, limit });
  });
});

describe("checkAdminRateLimit", () => {
  it("passes when the limiter allows", async () => {
    const limiter = vi.fn().mockResolvedValue({ success: true, remaining: 1 });
    const res = await checkAdminRateLimit({ pathname: "/api/admin/videos", method: "GET", userId: "u1", ip: "1.1.1.1", limiter });
    expect(res).toEqual({ limited: false });
    expect(limiter).toHaveBeenCalledTimes(2);
    expect(limiter.mock.calls[0][0]).toMatchObject({ key: "admin:read:user:u1", limit: 120, windowMs: 60_000 });
    expect(limiter.mock.calls[1][0]).toMatchObject({ key: "admin:read:ip:1.1.1.1" });
  });

  it("limits with Retry-After when the user key is exhausted", async () => {
    const limiter = vi.fn().mockResolvedValue({ success: false, remaining: 0 });
    const res = await checkAdminRateLimit({ pathname: "/api/admin/payments/p/refund", method: "POST", userId: "u1", ip: "1.1.1.1", limiter });
    expect(res).toEqual({ limited: true, retryAfterSeconds: 60, bucket: "payments-refund" });
    expect(limiter.mock.calls[0][0].limit).toBe(5);
  });

  it("limits on the IP key when the user key is fine", async () => {
    const limiter = vi.fn().mockResolvedValueOnce({ success: true }).mockResolvedValueOnce({ success: false });
    const res = await checkAdminRateLimit({ pathname: "/api/admin/videos", method: "POST", userId: "u1", ip: "2.2.2.2", limiter });
    expect(res.limited).toBe(true);
  });

  it("uses the IP key only when there is no user id", async () => {
    const limiter = vi.fn().mockResolvedValue({ success: true });
    await checkAdminRateLimit({ pathname: "/api/admin/health/clerk", method: "GET", userId: null, ip: "3.3.3.3", limiter });
    expect(limiter).toHaveBeenCalledTimes(1);
    expect(limiter.mock.calls[0][0].key).toBe("admin:read:ip:3.3.3.3");
  });

  it("runs user and IP checks in parallel", async () => {
    const order: string[] = [];
    const limiter = vi.fn(async ({ key }: { key: string }) => {
      order.push(`start:${key}`);
      await Promise.resolve();
      order.push(`end:${key}`);
      return { success: true, remaining: 1 };
    });
    await checkAdminRateLimit({ pathname: "/api/admin/videos", method: "GET", userId: "u", ip: "1.1.1.1", limiter: limiter as never });
    expect(order.slice(0, 2).every((e) => e.startsWith("start:"))).toBe(true);
  });

  it("fails open when the store hangs past the timeout", async () => {
    vi.useFakeTimers();
    try {
      const limiter = vi.fn(() => new Promise<never>(() => {}));
      const pending = checkAdminRateLimit({ pathname: "/api/admin/videos", method: "POST", userId: "u", ip: "1.1.1.1", limiter: limiter as never });
      await vi.advanceTimersByTimeAsync(ADMIN_RATE_LIMIT_TIMEOUT_MS + 1);
      await expect(pending).resolves.toEqual({ limited: false });
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not time out a fast store", async () => {
    vi.useFakeTimers();
    try {
      const limiter = vi.fn().mockResolvedValue({ success: false });
      const res = await checkAdminRateLimit({ pathname: "/api/admin/videos", method: "POST", userId: "u", ip: "1.1.1.1", limiter });
      expect(res.limited).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("fails open when the store throws", async () => {
    const limiter = vi.fn().mockRejectedValue(new Error("redis down"));
    const res = await checkAdminRateLimit({ pathname: "/api/admin/videos", method: "POST", userId: "u1", ip: "1.1.1.1", limiter });
    expect(res).toEqual({ limited: false });
  });
});

describe("getAdminClientIp", () => {
  it("prefers the last x-forwarded-for hop, then x-real-ip, then unknown", () => {
    expect(getAdminClientIp(new Headers({ "x-forwarded-for": "9.9.9.9, 4.4.4.4" }))).toBe("4.4.4.4");
    expect(getAdminClientIp(new Headers({ "x-real-ip": "5.5.5.5" }))).toBe("5.5.5.5");
    expect(getAdminClientIp(new Headers())).toBe("unknown");
  });
});
