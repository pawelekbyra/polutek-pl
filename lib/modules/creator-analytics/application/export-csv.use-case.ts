import type { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { toCsv } from "@/lib/modules/shared/csv";
import { fail, ok, type UseCaseResult } from "@/lib/modules/shared/result";
import { authorize } from "@/lib/modules/authz";
import { loadOverview, loadVideoList } from "../domain/read-models";
import { utcDayKey } from "../domain/period";
import { MAX_EXPORT_ROWS } from "../domain/types";
import { channelIdOf, periodOf, repositoryOf } from "./context";

export type AnalyticsExportKind = "videos" | "daily";

export interface AnalyticsCsv {
  filename: string;
  csv: string;
  rows: number;
  truncated: boolean;
}

const safeName = (s: string) => s.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "channel";

/**
 * CSV of the per-video table or of the daily series. Cells go through `toCsv` (quotes, CRLF, BOM and a leading
 * apostrophe on cells a spreadsheet would run as a formula), and the row count is capped at MAX_EXPORT_ROWS.
 * Averages withheld for a small sample stay empty, exactly as in the UI.
 */
export async function exportChannelAnalyticsCsv(
  ctx: AppContext,
  input: { range?: string | number | null; kind?: string | null },
): Promise<UseCaseResult<AnalyticsCsv, AppError>> {
  const channelId = channelIdOf(ctx);
  if (channelId instanceof AppError) return fail(channelId);
  const denied = await authorize(ctx, "channel.view_analytics", { channelId });
  if (denied) return fail(denied);
  const period = periodOf(ctx, input.range);
  if (period instanceof AppError) return fail(period);
  const kind: AnalyticsExportKind | null = input.kind === "daily" ? "daily" : !input.kind || input.kind === "videos" ? "videos" : null;
  if (!kind) return fail(new AppError("Nieznany rodzaj eksportu.", 400, "BAD_KIND"));

  const repo = repositoryOf(ctx);
  const channel = await repo.channelFacts(channelId);
  if (!channel) return fail(new AppError("Nie znaleziono kanału.", 404, "NOT_FOUND"));

  let header: string[];
  let body: unknown[][];
  if (kind === "videos") {
    const list = await loadVideoList(repo, channelId, period, MAX_EXPORT_ROWS);
    header = ["title", "slug", "status", "published_at", "views", "watch_seconds", "avg_percent_viewed", "comments", "likes"];
    body = list.items.map((v) => [v.title, v.slug, v.status, v.publishedAt, v.views, v.watchSeconds, v.avgPctViewed, v.comments, v.likes]);
  } else {
    const overview = await loadOverview(repo, channelId, period);
    if (!overview) return fail(new AppError("Nie znaleziono kanału.", 404, "NOT_FOUND"));
    header = ["day", "views", "watch_seconds", "subscribers"];
    body = overview.daily.map((d) => [d.day, d.views, d.watchSeconds, d.subscribers]);
  }
  const truncated = body.length > MAX_EXPORT_ROWS;
  const rows = body.slice(0, MAX_EXPORT_ROWS);
  const stamp = utcDayKey(ctx.now()).replace(/-/g, "");
  return ok({
    filename: `analytics-${safeName(channel.handle ?? channel.id)}-${kind}-${period.range}d-${stamp}.csv`,
    csv: toCsv(header, rows),
    rows: rows.length,
    truncated,
  });
}
