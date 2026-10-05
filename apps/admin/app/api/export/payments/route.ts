import { exportPaymentsCsv } from "@/lib/modules/admin-revenue";
import { allowAction, RATE } from "@admin/lib/actions/rate-limit";
import { hasFreshStepUp } from "@admin/lib/auth/guard";
import { jsonError, panelRouteContext, sampleDataResponse, unauthorizedJson } from "@admin/lib/api/panel-route";

export const dynamic = "force-dynamic";

const STATUSES = ["PENDING", "SUCCEEDED", "FAILED", "CANCELED", "REFUNDED", "PARTIALLY_REFUNDED", "DISPUTED", "CHARGEBACK_LOST"];
const CURRENCIES = ["PLN", "EUR", "USD", "CHF", "GBP"];
const day = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : undefined);

/** CSV of the filtered payments. Personal data (e-mail): fresh step-up required, rate limited, audited (PAYMENTS_EXPORTED). */
export async function GET(request: Request) {
  const ctx = await panelRouteContext(request);
  if (!ctx || ctx.actor.type !== "admin") return unauthorizedJson();
  const sample = sampleDataResponse();
  if (sample) return sample;
  if (!(await hasFreshStepUp())) return jsonError(403, "Eksport zawiera dane osobowe: najpierw potwierdź tożsamość (klucz dostępu albo TOTP).", "STEP_UP_REQUIRED");
  if (!allowAction(ctx.actor.userId, RATE.export)) return jsonError(429, "Za dużo eksportów. Spróbuj za kilka minut.", "RATE_LIMITED");
  const p = new URL(request.url).searchParams;
  const status = p.get("status");
  const currency = p.get("currency");
  const to = day(p.get("to"));
  const result = await exportPaymentsCsv(ctx, {
    status: status && STATUSES.includes(status) ? status : undefined,
    currency: currency && CURRENCIES.includes(currency) ? currency : undefined,
    q: p.get("q")?.slice(0, 120) || undefined,
    from: day(p.get("from")),
    to: to ? new Date(to.getTime() + 86_400_000) : undefined,
  });
  return new Response(result.csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="wplaty-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "private, no-store",
      "x-export-rows": String(result.rows),
      "x-export-truncated": String(result.truncated),
    },
  });
}
