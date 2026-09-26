import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getVideoInteraction: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/modules/users", () => ({ getVideoInteraction: mocks.getVideoInteraction }));

import { GET } from "@/app/api/videos/[id]/viewer-state/route";

const call = (id: string) => GET(new Request(`http://x/api/videos/${id}/viewer-state`), { params: Promise.resolve({ id }) });

describe("GET /api/videos/[id]/viewer-state", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the signed-in viewer's own like state, never cacheable", async () => {
    mocks.auth.mockResolvedValue({ userId: "user_1" });
    mocks.getVideoInteraction.mockResolvedValue({ liked: true, disliked: false });

    const res = await call("video_1");

    expect(mocks.getVideoInteraction).toHaveBeenCalledWith("user_1", "video_1");
    expect(await res.json()).toEqual({ liked: true, disliked: false });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("returns an empty state for guests without touching the database", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    const res = await call("video_1");

    expect(mocks.getVideoInteraction).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ liked: false, disliked: false });
  });
});
