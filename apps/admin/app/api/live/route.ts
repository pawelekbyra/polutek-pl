/**
 * GET /api/live[?video=<slug or id>]: Server-Sent Events for the live premiere mode. Same gate as every other
 * panel route: Cloudflare Access (proxy.ts) and a valid, enrolled admin session. Behind the tunnel the stream is
 * kept alive by a comment every 25 s; see lib/live-stream.ts.
 */
import { adminFromRequest, unauthorized } from "@admin/lib/auth/api-guard";
import { jsonError } from "@admin/lib/api/panel-route";
import { liveHubFor } from "@admin/lib/live-hubs";
import { createLiveStream } from "@admin/lib/live-stream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VIDEO_KEY = /^[A-Za-z0-9_-]{1,80}$/;

export async function GET(request: Request) {
  if (!(await adminFromRequest(request))) return unauthorized();
  const key = new URL(request.url).searchParams.get("video") ?? "";
  if (key && !VIDEO_KEY.test(key)) return jsonError(400, "Niepoprawny film.", "BAD_REQUEST");
  const hub = liveHubFor(key);
  const stream = hub ? createLiveStream({ hub, signal: request.signal }) : null;
  if (!stream) return jsonError(503, "Za dużo otwartych podglądów na żywo. Zamknij inne karty trybu premiery.", "LIVE_BUSY");
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      // no-transform: no proxy or compression layer may buffer or re-encode the stream.
      "cache-control": "private, no-store, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
