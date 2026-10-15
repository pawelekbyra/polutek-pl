import type { ReportTargetType } from "@prisma/client";
import type { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { fail, ok, type UseCaseResult } from "@/lib/modules/shared/result";
import { MainChannelPolicy } from "../domain/channel.policy";
import { sendReportReceipt } from "../infrastructure/moderation-notice";

/**
 * A signed-in viewer reports a video or a channel (DSA notice mechanism). Comments have their own report flow.
 * Any signed-in account may report, so there is no role check: the target must be publicly visible (a report is
 * never a way to probe hidden content), duplicates of a still-open report are refused and a reporter has a daily cap.
 */
export const REPORT_REASONS = ["SPAM", "HARASSMENT", "HATE", "NSFW", "VIOLENCE", "COPYRIGHT", "OTHER"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

const DAILY_CAP = 20;

export async function createContentReport(
  ctx: AppContext,
  input: { targetType: Exclude<ReportTargetType, "COMMENT">; targetId: string; reason: ReportReason; note?: string },
): Promise<UseCaseResult<{ id: string }, AppError>> {
  if (ctx.actor.type !== "user") return fail(new AppError("Zaloguj się, aby zgłosić treść.", 401, "UNAUTHENTICATED"));
  if (!REPORT_REASONS.includes(input.reason)) return fail(new AppError("Nieprawidłowy powód zgłoszenia.", 400, "INVALID_REASON"));
  const note = input.note?.trim().slice(0, 1000) || null;
  const reporterId = ctx.actor.userId;

  let channelId: string | null = null;
  if (input.targetType === "VIDEO") {
    const video = await ctx.prisma.video.findUnique({
      where: { id: input.targetId },
      select: { id: true, creatorId: true, status: true, moderationStatus: true, creator: { select: { status: true, deletedAt: true } } },
    });
    const visible = !!video && (video.status === "PUBLISHED" || video.status === "UNLISTED") && video.moderationStatus !== "REMOVED" && MainChannelPolicy.isPubliclyVisible(video.creator);
    if (!video || !visible) return fail(new AppError("Nie znaleziono treści.", 404, "NOT_FOUND"));
    channelId = video.creatorId;
  } else {
    const channel = await ctx.prisma.creator.findUnique({ where: { id: input.targetId }, select: { id: true, status: true, deletedAt: true } });
    if (!channel || !MainChannelPolicy.isPubliclyVisible(channel)) return fail(new AppError("Nie znaleziono treści.", 404, "NOT_FOUND"));
    channelId = channel.id;
  }

  const since = new Date(ctx.now().getTime() - 24 * 60 * 60 * 1000);
  const [duplicate, today] = await Promise.all([
    ctx.prisma.contentReport.findFirst({ where: { reporterId, targetType: input.targetType, targetId: input.targetId, status: "PENDING" }, select: { id: true } }),
    ctx.prisma.contentReport.count({ where: { reporterId, createdAt: { gte: since } } }),
  ]);
  if (duplicate) return fail(new AppError("Już zgłosiłeś tę treść. Zgłoszenie czeka na rozpatrzenie.", 409, "ALREADY_REPORTED"));
  if (today >= DAILY_CAP) return fail(new AppError("Za dużo zgłoszeń jednego dnia. Spróbuj jutro.", 429, "REPORT_RATE_LIMITED"));

  const report = await ctx.prisma.contentReport.create({
    data: { targetType: input.targetType, targetId: input.targetId, channelId, reporterId, reason: input.reason, note },
    select: { id: true },
  });
  // Receipt to the reporter (DSA art. 16(4)); best effort, never fails the report.
  await sendReportReceipt(ctx, { reportId: report.id, reporterId });
  return ok({ id: report.id });
}
