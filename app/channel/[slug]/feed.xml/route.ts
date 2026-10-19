import { NextRequest, NextResponse } from "next/server";
import { getChannelFeed, isNotModified } from "@/lib/modules/syndication";
import { rateLimit } from "@/lib/rate-limit";
import { getMediaClientIp } from "@/lib/media/rate-limit";
import { handleApiError } from "@/lib/errors";
import { getBaseUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Public on purpose (middleware.ts lists /channel/(.*)): readers poll feeds without any session. The answer is the
// same for everybody (published, due videos of a visible channel; title, link, date and a short text), so a short
// shared cache is safe. Per-IP limit like the other public endpoints.
const FEED_LIMIT = 60;
const FEED_WINDOW_MS = 60 * 1000;
const FEED_CACHE_CONTROL = "public, max-age=300, s-maxage=300, stale-while-revalidate=600";

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  try {
    const limited = await rateLimit({ key: `channel-feed:${getMediaClientIp(req)}`, limit: FEED_LIMIT, windowMs: FEED_WINDOW_MS });
    if (!limited.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Cache-Control": "private, no-store", "Retry-After": "60" } });
    }

    const { slug } = await props.params;
    const feed = await getChannelFeed({ channelKey: slug, baseUrl: getBaseUrl() });
    if (feed.status === "not_found") {
      return new NextResponse("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=60, s-maxage=60" } });
    }

    const headers = {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": FEED_CACHE_CONTROL,
      ETag: feed.etag,
      "Last-Modified": feed.lastModified.toUTCString(),
      "X-Content-Type-Options": "nosniff",
    };
    if (isNotModified({ ifNoneMatch: req.headers.get("if-none-match"), ifModifiedSince: req.headers.get("if-modified-since") }, feed)) {
      return new NextResponse(null, { status: 304, headers });
    }
    return new NextResponse(feed.xml, { status: 200, headers });
  } catch (error) {
    return handleApiError(error);
  }
}
