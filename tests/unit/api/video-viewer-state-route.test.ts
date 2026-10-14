import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getVideoInteraction: vi.fn(),
  getVideoProgressSeconds: vi.fn(),
}));

vi.mock("@/lib/auth/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/modules/users", () => ({ getVideoInteraction: mocks.getVideoInteraction }));
vi.mock("@/lib/modules/watch-progress", () => ({ getVideoProgressSeconds: mocks.getVideoProgressSeconds }));
vi.mock("@/lib/modules/shared/app-context", () => ({ createAppContext: () => ({ prisma: {} }) }));

import { GET } from "@/app/api/videos/[id]/viewer-state/route";

const call = (id: string) => GET(new Request(`http://x/api/videos/${id}/viewer-state`), { params: Promise.resolve({ id }) });

describe("GET /api/videos/[id]/viewer-state", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the signed-in viewer's own like state, never cacheable", async () => {
    mocks.auth.mockResolvedValue({ userId: "user_1" });
    mocks.getVideoInteraction.mockResolvedValue({ liked: true, disliked: false });
    mocks.getVideoProgressSeconds.mockResolvedValue(125);

    const res = await call("video_1");

    expect(mocks.getVideoInteraction).toHaveBeenCalledWith("user_1", "video_1");
    expect(mocks.getVideoProgressSeconds).toHaveBeenCalledWith("user_1", "video_1", expect.anything());
    expect(await res.json()).toEqual({ liked: true, disliked: false, progressSeconds: 125 });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("a failing progress read never breaks the like state", async () => {
    mocks.auth.mockResolvedValue({ userId: "user_1" });
    mocks.getVideoInteraction.mockResolvedValue({ liked: false, disliked: true });
    mocks.getVideoProgressSeconds.mockRejectedValue(new Error("db down"));

    const res = await call("video_1");

    expect(await res.json()).toEqual({ liked: false, disliked: true, progressSeconds: null });
  });

  it("returns an empty state for guests without touching the database", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    const res = await call("video_1");

    expect(mocks.getVideoInteraction).not.toHaveBeenCalled();
    expect(mocks.getVideoProgressSeconds).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ liked: false, disliked: false, progressSeconds: null });
  });
});
