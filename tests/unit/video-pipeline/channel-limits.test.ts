import { describe, expect, it, vi } from "vitest";
import { createAppContext, type AppContext } from "@/lib/modules/shared/app-context";
import type { Actor } from "@/lib/modules/shared/actor";
import { channelUploadLimitError, resolveChannelLimits } from "@/lib/modules/video-pipeline/application/channel-limits";
import { TRUST_LEVEL_LIMITS } from "@/lib/platform-limits";

const GIB = 1024 ** 3;
const NOW = new Date("2026-10-13T15:30:00Z");

function ctxFor(
  actor: Actor,
  state: { quota?: Record<string, number | bigint> | null; uploadsToday?: number; activeJobs?: number; storedBytes?: bigint | null } = {},
) {
  const prisma = {
    channelQuota: { findUnique: vi.fn(async () => state.quota ?? null) },
    videoOriginal: {
      count: vi.fn(async () => state.uploadsToday ?? 0),
      aggregate: vi.fn(async () => ({ _sum: { sizeBytes: state.storedBytes ?? null } })),
    },
    videoEncodeJob: { count: vi.fn(async () => state.activeJobs ?? 0) },
  };
  const ctx = createAppContext({ actor, prisma: prisma as never, now: () => NOW }) as AppContext;
  return { ctx, prisma };
}

const user: Actor = { type: "user", userId: "u1" };
const channel = { id: "ch-1", isPrimary: false };
const small = 100 * 1024 * 1024;

describe("channelUploadLimitError", () => {
  it("lets a small first upload through on the default (trust 0) limits", async () => {
    const { ctx } = ctxFor(user);
    expect(await channelUploadLimitError(ctx, channel, small)).toBeNull();
  });

  it("does not limit the flagship channel, staff or the system", async () => {
    const { ctx, prisma } = ctxFor(user, { uploadsToday: 999 });
    expect(await channelUploadLimitError(ctx, { id: "main", isPrimary: true }, 100 * GIB)).toBeNull();
    for (const actor of [{ type: "admin", userId: "a" } as const, { type: "system", reason: "w" } as const]) {
      const s = ctxFor(actor, { uploadsToday: 999 });
      expect(await channelUploadLimitError(s.ctx, channel, 100 * GIB)).toBeNull();
      expect(s.prisma.channelQuota.findUnique).not.toHaveBeenCalled();
    }
    expect(prisma.channelQuota.findUnique).not.toHaveBeenCalled();
  });

  it("refuses a file above the channel's single-file limit with 413", async () => {
    const { ctx } = ctxFor(user);
    const error = await channelUploadLimitError(ctx, channel, TRUST_LEVEL_LIMITS[0].maxUploadBytes + 1);
    expect(error?.statusCode).toBe(413);
    expect(error?.code).toBe("UPLOAD_TOO_LARGE_FOR_CHANNEL");
  });

  it("refuses when the daily upload count is reached (429)", async () => {
    const { ctx } = ctxFor(user, { uploadsToday: TRUST_LEVEL_LIMITS[0].maxUploadsPerDay });
    const error = await channelUploadLimitError(ctx, channel, small);
    expect(error?.code).toBe("UPLOAD_DAILY_LIMIT");
    expect(error?.statusCode).toBe(429);
  });

  it("refuses while too many encode jobs wait or run (429)", async () => {
    const { ctx } = ctxFor(user, { activeJobs: TRUST_LEVEL_LIMITS[0].maxQueuedJobs });
    expect((await channelUploadLimitError(ctx, channel, small))?.code).toBe("UPLOAD_QUEUE_LIMIT");
  });

  it("refuses when stored originals plus this file exceed the storage limit (507)", async () => {
    const used = BigInt(TRUST_LEVEL_LIMITS[0].maxStorageBytes - small + 1);
    const { ctx } = ctxFor(user, { storedBytes: used });
    const error = await channelUploadLimitError(ctx, channel, small);
    expect(error?.statusCode).toBe(507);
    const fits = ctxFor(user, { storedBytes: used - 1n });
    expect(await channelUploadLimitError(fits.ctx, channel, small)).toBeNull();
  });

  it("counts uploads from the start of the UTC day", async () => {
    const { ctx, prisma } = ctxFor(user);
    await channelUploadLimitError(ctx, channel, small);
    const call = prisma.videoOriginal.count.mock.calls[0] as unknown as [{ where: { createdAt: { gte: Date } } }];
    expect(call[0].where.createdAt.gte.toISOString()).toBe("2026-10-13T00:00:00.000Z");
  });

  it("a ChannelQuota row overrides the defaults", async () => {
    const { ctx } = ctxFor(user, {
      quota: { maxStorageBytes: BigInt(1 * GIB), maxUploadBytes: BigInt(50 * 1024 * 1024), maxVideoSeconds: 60, maxUploadsPerDay: 1, maxQueuedJobs: 1 },
    });
    expect(await resolveChannelLimits(ctx, "ch-1")).toEqual({ maxStorageBytes: GIB, maxUploadBytes: 50 * 1024 * 1024, maxVideoSeconds: 60, maxUploadsPerDay: 1, maxQueuedJobs: 1 });
    expect((await channelUploadLimitError(ctx, channel, small))?.statusCode).toBe(413);
  });
});
