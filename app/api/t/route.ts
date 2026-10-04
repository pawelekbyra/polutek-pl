import { after } from "next/server";
import { getClientIp } from "@/lib/api/client-ip";
import { BEACON_MAX_BYTES } from "@/lib/telemetry/beacon-constants";
import { telemetryCollectorUrl } from "@/lib/telemetry/config";

export const dynamic = "force-dynamic";

const NO_CONTENT = { status: 204, headers: { "Cache-Control": "no-store" } } as const;

/**
 * Analytics beacon (navigator.sendBeacon from TelemetryBeacon). Answers 204 at once, always: the page
 * never waits for statistics and a broken collector never shows up as an error. The body is handed to
 * pp-collector after the response (validation, bot filtering, the daily-salted visitor hash and the
 * database write all happen there). No cookie is read or set here. The client IP is forwarded only to
 * the collector, which hashes it and drops it.
 */
export async function POST(req: Request) {
  const collector = telemetryCollectorUrl();
  if (!collector) return new Response(null, NO_CONTENT);

  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > BEACON_MAX_BYTES) return new Response(null, NO_CONTENT);
  const body = await req.text();
  if (!body || body.length > BEACON_MAX_BYTES) return new Response(null, NO_CONTENT);

  const forward: Record<string, string> = {
    "content-type": "text/plain;charset=UTF-8",
    "user-agent": req.headers.get("user-agent") ?? "",
    "x-pp-client-ip": getClientIp(req.headers),
    "x-pp-country": req.headers.get("cf-ipcountry") ?? "",
    "x-pp-origin": req.headers.get("origin") ?? "",
    "x-pp-referer": req.headers.get("referer") ?? "",
    "x-pp-dnt": req.headers.get("sec-gpc") === "1" || req.headers.get("dnt") === "1" ? "1" : "0",
  };

  after(async () => {
    try {
      await fetch(`${collector}/api/t`, {
        method: "POST",
        headers: forward,
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(2000),
      });
    } catch {
      // Fail-open: statistics are best-effort.
    }
  });
  return new Response(null, NO_CONTENT);
}
