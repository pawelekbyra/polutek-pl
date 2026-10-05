import { z } from "zod";
import { exportUsersCsv, USER_SEGMENTS } from "@/lib/modules/admin-community";
import { checkRateLimit } from "@admin/lib/actions/rate-limit";
import { adminFromRequest } from "@admin/lib/auth/api-guard";
import { hasFreshStepUp } from "@admin/lib/auth/guard";
import { jsonError, panelRouteContext, readJson, sampleDataResponse, unauthorizedJson } from "@admin/lib/api/panel-route";
import { errorMessage } from "@admin/lib/actions/panel";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ q: z.string().max(120).optional(), seg: z.enum(USER_SEGMENTS).optional() }).strict();

/**
 * CSV export of the accounts list (personal data). POST so the proxy's CSRF rule applies; needs a session AND a
 * fresh step-up (403 STEP_UP_REQUIRED, the page then sends the owner to /potwierdz); at most 5 per hour; the use
 * case writes the USERS_EXPORT audit row. The answer is the file itself, never cached.
 */
export async function POST(request: Request) {
  const admin = await adminFromRequest(request);
  if (!admin) return unauthorizedJson();
  const dev = sampleDataResponse();
  if (dev) return dev;
  const body = await readJson(request, bodySchema);
  if (!body.ok) return body.response;
  const limited = checkRateLimit(admin.userId, { bucket: "users-export", max: 5, windowMs: 60 * 60_000 });
  if (!limited.ok) return jsonError(429, `Za dużo eksportów. Spróbuj za ${Math.ceil(limited.retryAfterSeconds / 60)} min.`, "RATE_LIMITED");
  if (!(await hasFreshStepUp())) return jsonError(403, "Najpierw potwierdź tożsamość (klucz dostępu albo kod TOTP).", "STEP_UP_REQUIRED");
  const ctx = await panelRouteContext(request);
  if (!ctx) return unauthorizedJson();
  const result = await exportUsersCsv(ctx, { q: body.data.q?.trim() || undefined, seg: body.data.seg });
  if (!result.ok) {
    const { message, code } = errorMessage(result.error);
    const e = result.error as { statusCode?: number; message?: string };
    const status = typeof e.statusCode === "number" && e.statusCode >= 400 && e.statusCode < 600 ? e.statusCode : 500;
    return jsonError(status, status === 413 && e.message ? e.message : message, code);
  }
  return new Response(result.data.csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${result.data.fileName}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "x-export-rows": String(result.data.rows),
    },
  });
}
