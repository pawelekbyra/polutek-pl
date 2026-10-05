/**
 * Morning report (built, DISABLED by default). GET ?preview=1: the report as JSON for the signed-in admin (never
 * sends). POST: sends it only when ADMIN_MORNING_REPORT=on and ADMIN_MORNING_REPORT_TO is set; otherwise answers
 * `disabled`. Authorised by the admin session, or by `Authorization: Bearer <ADMIN_JOBS_TOKEN>` (>= 32 characters)
 * for a scheduler; both still pass Cloudflare Access first (proxy.ts). docs/architecture/admin-phaseA.md.
 */
import { runMorningReport } from "@/lib/modules/admin-analytics";
import { sendOperatorEmail } from "@/lib/modules/email";
import { adminFromRequest, unauthorized } from "@admin/lib/auth/api-guard";
import { jsonOk } from "@admin/lib/api/panel-route";
import { analyticsDeps } from "@admin/lib/analytics";
import { tokenAuthorised } from "@admin/lib/jobs-auth";

export const dynamic = "force-dynamic";

const mailer = (m: { to: string; subject: string; html: string; idempotencyKey: string }) =>
  sendOperatorEmail({ ...m, kind: "admin-morning-report" });

export async function GET(request: Request) {
  if (!(await adminFromRequest(request))) return unauthorized();
  const result = await runMorningReport(analyticsDeps(), { mailer, preview: true });
  return jsonOk(result);
}

export async function POST(request: Request) {
  const ok = tokenAuthorised(request.headers.get("authorization"), process.env.ADMIN_JOBS_TOKEN) || !!(await adminFromRequest(request));
  if (!ok) return unauthorized();
  const result = await runMorningReport(analyticsDeps(), { mailer });
  return jsonOk(result.status === "sent" ? { status: "sent", day: result.report.day } : result);
}
