import { exportAuditCsv, type AuditFilters } from "@/lib/modules/admin-security";
import { allowAction, RATE } from "@admin/lib/actions/rate-limit";
import { stepUpMessage } from "@admin/lib/config";
import { hasFreshStepUp } from "@admin/lib/auth/guard";
import { jsonError, panelRouteContext, sampleDataResponse, unauthorizedJson } from "@admin/lib/api/panel-route";

export const dynamic = "force-dynamic";

const ACTORS = ["admin", "system", "user", "guest"] as const;
const day = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : undefined);

/** CSV of the filtered audit log. IP addresses inside: fresh step-up, rate limit, and the export is itself audited. */
export async function GET(request: Request) {
  const ctx = await panelRouteContext(request);
  if (!ctx || ctx.actor.type !== "admin") return unauthorizedJson();
  const sample = sampleDataResponse();
  if (sample) return sample;
  if (!(await hasFreshStepUp())) return jsonError(403, stepUpMessage("Dziennik zawiera adresy IP: najpierw potwierdź tożsamość (klucz dostępu albo TOTP)."), "STEP_UP_REQUIRED");
  if (!allowAction(ctx.actor.userId, RATE.export)) return jsonError(429, "Za dużo eksportów. Spróbuj za kilka minut.", "RATE_LIMITED");
  const p = new URL(request.url).searchParams;
  const actor = p.get("actor");
  const to = day(p.get("to"));
  const filters: AuditFilters = {
    q: p.get("q")?.slice(0, 120) || undefined,
    actorType: ACTORS.find((a) => a === actor),
    targetType: p.get("kind")?.slice(0, 60) || undefined,
    from: day(p.get("from")),
    to: to ? new Date(to.getTime() + 86_400_000) : undefined,
  };
  const result = await exportAuditCsv(ctx, filters);
  return new Response(result.csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="audyt-${new Date().toISOString().slice(0, 10)}.csv"`, "cache-control": "private, no-store", "x-export-rows": String(result.rows), "x-export-truncated": String(result.truncated) },
  });
}
