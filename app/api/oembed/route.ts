import { NextRequest, NextResponse } from "next/server";
import { getOembed, isSupportedOembedFormat } from "@/lib/modules/syndication";
import { parseEmbedDimension } from "@/lib/embed/embed-snippet";
import { rateLimit } from "@/lib/rate-limit";
import { getMediaClientIp } from "@/lib/media/rate-limit";
import { handleApiError } from "@/lib/errors";
import { getBaseUrl } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

export const dynamic = "force-dynamic";

// Public on purpose (middleware.ts): consumers (link unfurlers, CMSs) call it server-side without a session. It answers
// only for PUBLIC-tier published videos; everything else is the same 404, so it leaks nothing about hidden videos.
const OEMBED_LIMIT = 60;
const OEMBED_WINDOW_MS = 60 * 1000;
const CORS = { "Access-Control-Allow-Origin": "*" };

function json(body: unknown, status: number, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...CORS, ...extra } });
}

export async function GET(req: NextRequest) {
  try {
    const limited = await rateLimit({ key: `oembed:${getMediaClientIp(req)}`, limit: OEMBED_LIMIT, windowMs: OEMBED_WINDOW_MS });
    if (!limited.success) return json({ error: "Too many requests" }, 429, { "Cache-Control": "private, no-store", "Retry-After": "60" });

    const params = req.nextUrl.searchParams;
    // oEmbed 1.0: a format the provider does not serve is 501 (only JSON is served).
    if (!isSupportedOembedFormat(params.get("format"))) {
      return json({ error: "Unsupported format" }, 501, { "Cache-Control": "public, max-age=3600, s-maxage=3600" });
    }

    const result = await getOembed({
      url: params.get("url"),
      baseUrl: getBaseUrl(),
      providerName: APP_NAME,
      maxWidth: parseEmbedDimension(params.get("maxwidth")),
      maxHeight: parseEmbedDimension(params.get("maxheight")),
    });
    if (result.status === "bad_request") return json({ error: "Missing url parameter" }, 400, { "Cache-Control": "public, max-age=60, s-maxage=60" });
    if (result.status === "not_found") return json({ error: "Not found" }, 404, { "Cache-Control": "public, max-age=60, s-maxage=60" });

    return json(result.body, 200, { "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600" });
  } catch (error) {
    return handleApiError(error);
  }
}
