import type { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { PrismaAnalyticsRepository } from "../infrastructure/analytics.repository";
import { buildPeriod, parseRange, type AnalyticsPeriod } from "../domain/period";

/** Wiring shared by the analytics use cases (no authorization here: each use case calls authorize() itself). */

export function channelIdOf(ctx: AppContext): string | AppError {
  return ctx.channelId ?? new AppError("Najpierw załóż kanał.", 409, "NO_CHANNEL");
}

export function periodOf(ctx: AppContext, rangeInput: string | number | null | undefined): AnalyticsPeriod | AppError {
  const range = parseRange(rangeInput === null || rangeInput === undefined ? null : String(rangeInput));
  if (range === null) return new AppError("Dozwolone okresy: 7, 28 lub 90 dni.", 400, "BAD_RANGE");
  return buildPeriod(range, ctx.now());
}

export const repositoryOf = (ctx: AppContext) => new PrismaAnalyticsRepository(ctx.db.read);
