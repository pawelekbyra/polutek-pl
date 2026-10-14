import type { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { defaultLimitsFor, type ChannelLimits } from "@/lib/platform-limits";
import { isMainChannelId } from "@/lib/modules/channel";

/**
 * Per-channel upload limits (CLAUDE.md 4.24): the size of one file, uploads per UTC day, encode jobs waiting or
 * running, and total stored originals. The channel's `ChannelQuota` row overrides the defaults of its trust level.
 * The platform's own flagship channel (the `main_channel_id` setting) keeps the historical global limits only, and so do staff.
 *
 * Checked when an upload is reserved, not while bytes flow: a refusal costs nothing.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const NOT_COUNTED_ORIGINALS = ["ABANDONED", "SUPERSEDED", "FAILED"] as const;

function startOfUtcDay(now: Date): Date {
  return new Date(Math.floor(now.getTime() / DAY_MS) * DAY_MS);
}

export async function resolveChannelLimits(ctx: AppContext, channelId: string): Promise<ChannelLimits> {
  const quota = await ctx.prisma.channelQuota.findUnique({ where: { channelId } });
  if (!quota) return defaultLimitsFor(0);
  return {
    maxStorageBytes: Number(quota.maxStorageBytes),
    maxUploadBytes: Number(quota.maxUploadBytes),
    maxVideoSeconds: quota.maxVideoSeconds,
    maxUploadsPerDay: quota.maxUploadsPerDay,
    maxQueuedJobs: quota.maxQueuedJobs,
  };
}

/** `null` when the upload fits, otherwise the error to return (413 too large, 429 too many, 507 no space). */
export async function channelUploadLimitError(
  ctx: AppContext,
  channel: { id: string },
  fileSize: number,
): Promise<AppError | null> {
  // Limits protect the platform from creators; platform staff and the system are not creators.
  if (ctx.actor.type !== "user") return null;
  if (await isMainChannelId(ctx.prisma, channel.id)) return null;

  const limits = await resolveChannelLimits(ctx, channel.id);
  const mib = (bytes: number) => Math.round(bytes / (1024 * 1024));

  if (fileSize > limits.maxUploadBytes) {
    return new AppError(
      `Plik jest większy niż limit Twojego kanału (${mib(limits.maxUploadBytes)} MB).`,
      413,
      "UPLOAD_TOO_LARGE_FOR_CHANNEL",
    );
  }

  const since = startOfUtcDay(ctx.now());
  const [uploadsToday, activeJobs, stored] = await Promise.all([
    ctx.prisma.videoOriginal.count({ where: { video: { creatorId: channel.id }, createdAt: { gte: since } } }),
    ctx.prisma.videoEncodeJob.count({ where: { video: { creatorId: channel.id }, status: { in: ["QUEUED", "RUNNING"] } } }),
    ctx.prisma.videoOriginal.aggregate({
      where: { video: { creatorId: channel.id }, status: { notIn: [...NOT_COUNTED_ORIGINALS] } },
      _sum: { sizeBytes: true },
    }),
  ]);

  if (uploadsToday >= limits.maxUploadsPerDay) {
    return new AppError(
      `Osiągnięto dzienny limit przesyłania (${limits.maxUploadsPerDay} filmów). Spróbuj jutro.`,
      429,
      "UPLOAD_DAILY_LIMIT",
    );
  }
  if (activeJobs >= limits.maxQueuedJobs) {
    return new AppError(
      "Poczekaj, aż skończy się przetwarzanie poprzednich filmów, zanim dodasz kolejny.",
      429,
      "UPLOAD_QUEUE_LIMIT",
    );
  }
  const used = Number(stored._sum.sizeBytes ?? 0);
  if (used + fileSize > limits.maxStorageBytes) {
    return new AppError("Nie ma już miejsca na koncie kanału. Usuń stare filmy albo poproś o większy limit.", 507, "UPLOAD_STORAGE_LIMIT");
  }
  return null;
}
