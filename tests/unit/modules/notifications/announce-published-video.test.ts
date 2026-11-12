import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
const kick = vi.fn();
vi.mock("@/lib/modules/notifications", () => ({ kickNewVideoFanOutJobs: () => kick() }));

import { announcePublishedVideo } from "@/lib/modules/video/application/announce-published-video";

describe("announcePublishedVideo", () => {
  it("kicks the durable fan-out runner after the commit", async () => {
    await announcePublishedVideo("v1");
    expect(kick).toHaveBeenCalledTimes(1);
  });

  it("swallows a failed runner kick because the committed intent remains durable", async () => {
    kick.mockImplementationOnce(() => { throw new Error("boom"); });
    await expect(announcePublishedVideo("v1")).resolves.toBeUndefined();
  });
});
