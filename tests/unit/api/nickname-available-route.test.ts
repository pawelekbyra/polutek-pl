import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { NextRequest } from "next/server";

const { findFirst, rateLimitMock } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  rateLimitMock: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({ rateLimit: rateLimitMock }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findFirst } } }));

import { GET } from "@/app/api/users/nickname-available/route";

const req = (name: string, ip = "1.2.3.4") =>
  new NextRequest(`http://localhost/api/users/nickname-available?name=${encodeURIComponent(name)}`, {
    headers: { "x-forwarded-for": ip },
  });

describe("GET /api/users/nickname-available", () => {
  beforeEach(() => {
    findFirst.mockReset().mockResolvedValue(null);
    rateLimitMock.mockReset().mockResolvedValue({ success: true, remaining: 10 });
  });

  it("says a free nickname is available", async () => {
    const res = await GET(req("  Żółty   Kot "));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ available: true });
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(findFirst).toHaveBeenCalledWith({
      where: { isDeleted: false, name: { equals: "Żółty Kot", mode: "insensitive" } },
      select: { id: true },
    });
  });

  it("says taken when another non-deleted user has that name, without revealing who", async () => {
    findFirst.mockResolvedValue({ id: "user_secret" });
    const res = await GET(req("paweł perfect"));
    const body = await res.json();
    expect(body).toEqual({ available: false, reason: "taken" });
    expect(JSON.stringify(body)).not.toContain("user_secret");
  });

  it("rejects invalid nicknames without touching the database", async () => {
    expect(await (await GET(req("ab"))).json()).toEqual({ available: false, reason: "too_short" });
    expect(await (await GET(req("kot@dom"))).json()).toEqual({ available: false, reason: "invalid_chars" });
    expect(await (await GET(req("x".repeat(31)))).json()).toEqual({ available: false, reason: "too_long" });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("is rate-limited per IP", async () => {
    rateLimitMock.mockResolvedValue({ success: false, remaining: 0 });
    const res = await GET(req("Kot", "9.9.9.9"));
    expect(res.status).toBe(429);
    expect(rateLimitMock).toHaveBeenCalledWith(expect.objectContaining({ key: "nickname-available:9.9.9.9" }));
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("is a public route in middleware (the sso-callback form has no session yet)", () => {
    const middleware = readFileSync("middleware.ts", "utf8");
    expect(middleware).toContain("'/api/users/nickname-available'");
  });
});
