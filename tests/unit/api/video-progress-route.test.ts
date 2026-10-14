import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getActorFromAuth: vi.fn(),
  rateLimit: vi.fn(),
  saveVideoProgress: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({ getActorFromAuth: mocks.getActorFromAuth }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("@/lib/modules/shared/app-context", () => ({ createAppContext: (init: unknown) => ({ ...(init as object) }) }));
vi.mock("@/lib/modules/watch-progress", () => ({
  PROGRESS_MAX_SECONDS: 86400,
  saveVideoProgress: mocks.saveVideoProgress,
}));

import { POST } from "@/app/api/videos/[id]/progress/route";
import { AppError } from "@/lib/errors";

const params = { params: Promise.resolve({ id: "video-1" }) };
const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new NextRequest("http://localhost/api/videos/video-1/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json", host: "localhost", origin: "http://localhost", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    params,
  );

describe("POST /api/videos/[id]/progress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActorFromAuth.mockResolvedValue({ type: "user", userId: "u1" });
    mocks.rateLimit.mockResolvedValue({ success: true });
    mocks.saveVideoProgress.mockResolvedValue({ ok: true, data: { status: "saved" } });
  });

  it("passes a valid report to the use case for the signed-in viewer, never cacheable", async () => {
    const response = await post({ positionSeconds: 42.5, durationSeconds: 600 });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "saved" });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.saveVideoProgress).toHaveBeenCalledWith(
      { videoId: "video-1", positionSeconds: 42.5, durationSeconds: 600 },
      expect.objectContaining({ actor: { type: "user", userId: "u1" } }),
    );
  });

  it("accepts a report without a duration (beacon from a player that has none yet)", async () => {
    const response = await post({ positionSeconds: 30 });
    expect(response.status).toBe(200);
    expect(mocks.saveVideoProgress).toHaveBeenCalledWith(
      { videoId: "video-1", positionSeconds: 30, durationSeconds: null },
      expect.anything(),
    );
  });

  it("answers 401 for a guest and stores nothing", async () => {
    mocks.getActorFromAuth.mockResolvedValue({ type: "guest" });
    const response = await post({ positionSeconds: 30 });

    expect(response.status).toBe(401);
    expect(mocks.saveVideoProgress).not.toHaveBeenCalled();
  });

  it("rejects an invalid body with 400", async () => {
    for (const body of [{}, { positionSeconds: -1 }, { positionSeconds: "12" }, { positionSeconds: 999999 }, "not json"]) {
      const response = await post(body as never);
      expect(response.status).toBe(400);
    }
    expect(mocks.saveVideoProgress).not.toHaveBeenCalled();
  });

  it("is rate limited per viewer", async () => {
    mocks.rateLimit.mockResolvedValue({ success: false });
    const response = await post({ positionSeconds: 30 });

    expect(response.status).toBe(429);
    expect(mocks.rateLimit).toHaveBeenCalledWith(expect.objectContaining({ key: "video-progress:u1" }));
    expect(mocks.saveVideoProgress).not.toHaveBeenCalled();
  });

  it("answers 404 when the viewer has no access to the video", async () => {
    mocks.saveVideoProgress.mockResolvedValue({ ok: false, error: new AppError("Video not found", 404, "NOT_FOUND") });
    const response = await post({ positionSeconds: 30 });
    expect(response.status).toBe(404);
  });

  it("rejects a cross-origin POST", async () => {
    const response = await post({ positionSeconds: 30 }, { origin: "https://evil.example" });
    expect(response.status).toBe(403);
    expect(mocks.saveVideoProgress).not.toHaveBeenCalled();
  });
});
