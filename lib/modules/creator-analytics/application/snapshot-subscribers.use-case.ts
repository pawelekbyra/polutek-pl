import type { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { fail, ok, type UseCaseResult } from "@/lib/modules/shared/result";
import { dayKeyToDate, utcDayKey } from "../domain/period";

export interface SnapshotSubscribersOutput {
  day: string;
  channels: number;
  written: number;
}

const PAGE = 200;

/**
 * Daily cron: stores each active channel's subscriber count under today's UTC day (`SubscriberSnapshot`, one row per
 * channel and day). Idempotent: running again the same day only overwrites that day's row with the newer count.
 * Only the `system` actor may run it (a cron, never a request on behalf of a user). The channel set is the publicly
 * visible one (ACTIVE or LIMITED, not deleted); other statuses have no audience to chart.
 */
export async function snapshotSubscriberCounts(ctx: AppContext): Promise<UseCaseResult<SnapshotSubscribersOutput, AppError>> {
  if (ctx.actor.type !== "system") return fail(new AppError("Brak uprawnień.", 403, "FORBIDDEN"));
  const day = utcDayKey(ctx.now());
  const dayDate = dayKeyToDate(day);
  let cursor: string | undefined;
  let channels = 0;
  let written = 0;

  for (;;) {
    const page = await ctx.prisma.creator.findMany({
      where: { status: { in: ["ACTIVE", "LIMITED"] }, deletedAt: null },
      select: { id: true, subscribersCount: true },
      orderBy: { id: "asc" },
      take: PAGE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (page.length === 0) break;
    for (const c of page) {
      channels++;
      const subscribers = Math.max(0, c.subscribersCount ?? 0);
      await ctx.prisma.subscriberSnapshot.upsert({
        where: { channelId_day: { channelId: c.id, day: dayDate } },
        create: { channelId: c.id, day: dayDate, subscribers },
        update: { subscribers },
      });
      written++;
    }
    if (page.length < PAGE) break;
    cursor = page[page.length - 1].id;
  }
  return ok({ day, channels, written });
}
