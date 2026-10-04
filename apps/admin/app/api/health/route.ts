/**
 * Liveness of the panel process for the container healthcheck (127.0.0.1:3100, no Access JWT).
 * Says only "the process answers"; the database and everything else is on the System screen, behind
 * sign-in. Never add details here: this path is the one place that skips Cloudflare Access.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
