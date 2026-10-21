import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getActorFromAuth: vi.fn(),
  rateLimit: vi.fn(),
  setVideoFavorite: vi.fn(),
  isVideoFavorited: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({ getActorFromAuth: mocks.getActorFromAuth }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("@/lib/modules/shared/app-context", () => ({ createAppContext: (init: unknown) => ({ ...(init as object) }) }));
vi.mock("@/lib/modules/favorites", () => ({
  setVideoFavorite: mocks.setVideoFavorite,
  isVideoFavorited: mocks.isVideoFavorited,
}));

import { GET, PUT } from "@/app/api/videos/[id]/favorite/route";
import { AppError } from "@/lib/errors";

const params = { params: Promise.resolve({ id: "video-1" }) };
const put = (body: unknown, headers: Record<string, string> = {}) =>
  PUT(
    new NextRequest("http://localhost/api/videos/video-1/favorite", {
      method: "PUT",
      headers: { "Content-Type": "application/json", host: "localhost", origin: "http://localhost", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    params,
  );
const get = () => GET(new NextRequest("http://localhost/api/videos/video-1/favorite"), params);

describe("PUT /api/videos/[id]/favorite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActorFromAuth.mockResolvedValue({ type: "user", userId: "u1" });
    mocks.rateLimit.mockResolvedValue({ success: true });
    mocks.setVideoFavorite.mockResolvedValue({ ok: true, data: { favorited: true } });
    mocks.isVideoFavorited.mockResolvedValue(true);
  });

  it("sets the wanted state for the signed-in viewer, never cacheable", async () => {
    const response = await put({ favorite: true });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ favorited: true });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.setVideoFavorite).toHaveBeenCalledWith(
      { videoId: "video-1", favorite: true },
      expect.objectContaining({ actor: { type: "user", userId: "u1" } }),
    );
    expect(mocks.rateLimit).toHaveBeenCalledWith(expect.objectContaining({ key: "video-favorites:u1" }));
  });

  it("answers 401 for a guest and stores nothing", async () => {
    mocks.getActorFromAuth.mockResolvedValue({ type: "guest" });
    expect((await put({ favorite: true })).status).toBe(401);
    expect(mocks.setVideoFavorite).not.toHaveBeenCalled();
  });

  it("rejects an invalid body with 400", async () => {
    for (const body of [{}, { favorite: "yes" }, { favorite: null }, "not json"]) {
      expect((await put(body)).status).toBe(400);
    }
    expect(mocks.setVideoFavorite).not.toHaveBeenCalled();
  });

  it("answers 429 when rate limited", async () => {
    mocks.rateLimit.mockResolvedValue({ success: false });
    expect((await put({ favorite: true })).status).toBe(429);
    expect(mocks.setVideoFavorite).not.toHaveBeenCalled();
  });

  it("refuses a cross-origin write", async () => {
    const response = await put({ favorite: true }, { origin: "https://evil.example" });
    expect(response.status).toBe(403);
    expect(mocks.setVideoFavorite).not.toHaveBeenCalled();
  });

  it("maps a use-case 404 (video not on the lists) to 404", async () => {
    mocks.setVideoFavorite.mockResolvedValue({ ok: false, error: new AppError("Video not found", 404, "NOT_FOUND") });
    expect((await put({ favorite: true })).status).toBe(404);
  });
});

describe("GET /api/videos/[id]/favorite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isVideoFavorited.mockResolvedValue(true);
  });

  it("returns the own state of the viewer", async () => {
    mocks.getActorFromAuth.mockResolvedValue({ type: "user", userId: "u1" });
    const response = await get();
    expect(await response.json()).toEqual({ favorited: true });
    expect(mocks.isVideoFavorited).toHaveBeenCalledWith("u1", "video-1", expect.anything());
  });

  it("returns false for a guest without reading anything", async () => {
    mocks.getActorFromAuth.mockResolvedValue({ type: "guest" });
    expect(await (await get()).json()).toEqual({ favorited: false });
    expect(mocks.isVideoFavorited).not.toHaveBeenCalled();
  });
});
