import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
const m = vi.hoisted(() => ({ auth: vi.fn(), rate: vi.fn(), context: vi.fn(), createContext: vi.fn() }));
vi.mock("@/lib/api/auth", () => ({ getActorFromAuth: m.auth }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: m.rate }));
vi.mock("@/lib/modules/shared/app-context", () => ({ createAppContext: m.createContext }));
vi.mock("@/lib/modules/comments", () => ({ getCommentContext: m.context, commentErrorStatus: (error: { type: string }) => error.type === "NOT_FOUND" ? 404 : 403 }));
const { GET } = await import("@/app/api/comments/[commentId]/context/route");
const request = () => new NextRequest("https://www.pawelperfect.com/api/comments/c1/context", { headers: { "x-forwarded-for": "198.51.100.42" } });
const props = { params: Promise.resolve({ commentId: "c1" }) };
beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ type: "guest" });
  m.rate.mockResolvedValue({ success: true, remaining: 10 });
  m.createContext.mockImplementation((input) => input);
  m.context.mockResolvedValue({ ok: true, data: { comment: { id: "c1" }, parentComment: null, videoId: "v1", canView: true } });
});
describe("comment deep-link context route", () => {
  it("lets the use case authorize reads (a guest never reaches it through the middleware), with an IP rate limit and private response", async () => {
    const response = await GET(request(), props);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(m.context).toHaveBeenCalledWith({ commentId: "c1" }, { actor: { type: "guest" } });
    expect(m.rate).toHaveBeenCalledWith({ key: "comment-context:ip:198.51.100.42", limit: 120, windowMs: 60_000 });
    // Guests are stopped earlier, by the middleware (only GET /api/comments and .../replies are public); this route stays defence in depth.
    expect(readFileSync("middleware.ts", "utf8")).not.toContain("'/api/comments/(.*)/context'");
  });
  it("rate limits signed-in viewers by account and does not load context when throttled", async () => {
    m.auth.mockResolvedValue({ type: "user", userId: "me" });
    m.rate.mockResolvedValue({ success: false, remaining: 0 });
    const response = await GET(request(), props);
    expect(response.status).toBe(429);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("retry-after")).toBe("60");
    expect(m.rate).toHaveBeenCalledWith(expect.objectContaining({ key: "comment-context:user:me" }));
    expect(m.context).not.toHaveBeenCalled();
  });
  it("returns access/visibility denials privately without content", async () => {
    for (const [type, status] of [["NOT_FOUND", 404], ["FORBIDDEN", 403]] as const) {
      m.context.mockResolvedValueOnce({ ok: false, error: { type, message: "Unavailable" } });
      const response = await GET(request(), props);
      expect(response.status).toBe(status);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.json()).not.toHaveProperty("comment");
    }
  });
});
