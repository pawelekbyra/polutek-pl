import { NextRequest, NextResponse } from "next/server";
import { parsePublicSearchParams, searchPublicVideos } from "@/lib/modules/video";
import { auth } from "@/lib/auth/server";
import { takeSearchBudget } from "@/lib/search-rate-limit";
import { getMediaClientIp } from "@/lib/media/rate-limit";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

// Public on purpose (middleware.ts). What may appear is decided inside the query (PUBLISHED, visible channel, past premiere,
// 18+ only for signed-in viewers); gated tiers come back as title and thumbnail only. The answer depends on the viewer
// (18+), so it is never stored by a shared cache.
const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(req: NextRequest) {
  try {
    const limited = await takeSearchBudget(getMediaClientIp(req));
    if (!limited.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { ...NO_STORE, "Retry-After": "60" } });
    }
    const params = parsePublicSearchParams(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const session = await auth().catch(() => null);
    const page = await searchPublicVideos(params, { signedIn: Boolean(session?.user) });
    return NextResponse.json(
      {
        items: page.items.map((item) => ({
          id: item.id,
          slug: item.slug,
          title: item.title,
          titleEn: item.titleEn ?? null,
          snippet: item.snippet,
          thumbnailUrl: item.thumbnailUrl,
          duration: item.duration ?? null,
          tier: item.tier,
          views: item.views,
          publishedAt: item.publishedAt ?? null,
          isAdult: item.isAdult === true,
          tags: item.tags,
          category: item.category,
          channel: item.creator ? { id: item.creator.id, name: item.creator.name, slug: item.creator.slug } : null,
        })),
        nextCursor: page.nextCursor,
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
