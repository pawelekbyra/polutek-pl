import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
const notify = vi.fn();
vi.mock("@/lib/modules/notifications", () => ({ notifyNewVideoPublished: (id: string) => notify(id) }));

import { announcePublishedVideo } from "@/lib/modules/video/application/announce-published-video";

describe("announcePublishedVideo", () => {
  it("hands the video to the fan-out", async () => {
    notify.mockResolvedValueOnce({ status: "done", inApp: 1 });
    await announcePublishedVideo("v1");
    expect(notify).toHaveBeenCalledWith("v1");
  });

  it("swallows a failing fan-out so the publication result is untouched", async () => {
    notify.mockRejectedValueOnce(new Error("boom"));
    await expect(announcePublishedVideo("v1")).resolves.toBeUndefined();
  });
});
