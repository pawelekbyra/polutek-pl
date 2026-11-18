import { describe, expect, it, vi } from "vitest";
import { MainChannelService } from "@/lib/modules/channel/application/main-channel.service";
import { createAppContext } from "@/lib/modules/shared/app-context";

describe("MainChannelService injected database composition", () => {
  it("uses the injected database through the real service and repository", async () => {
    const channel = { id: "creator-injected", slug: "injected", status: "ACTIVE", deletedAt: null };
    const findUnique = vi.fn().mockResolvedValue(channel);
    const injectedDb = { creator: { findUnique } };
    const context = createAppContext({
      actor: { type: "user", userId: "viewer-1" },
      prisma: injectedDb as never,
    });

    await expect(MainChannelService.getPubliclyVisibleById(context, channel.id)).resolves.toEqual(channel);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: channel.id } });
  });
});
