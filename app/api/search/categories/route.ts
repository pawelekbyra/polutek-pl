import { NextRequest, NextResponse } from "next/server";
import { getSearchFacets } from "@/lib/modules/video";
import { auth } from "@/lib/auth/server";
import { rateLimit } from "@/lib/rate-limit";
import { getMediaClientIp } from "@/lib/media/rate-limit";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

// Categories with the number of searchable videos (same visibility rules as /api/search) plus the most used tags.
const FACETS_LIMIT = 60;
const FACETS_WINDOW_MS = 60 * 1000;
const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(req: NextRequest) {
  try {
    const limited = await rateLimit({ key: `search-facets:${getMediaClientIp(req)}`, limit: FACETS_LIMIT, windowMs: FACETS_WINDOW_MS });
    if (!limited.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { ...NO_STORE, "Retry-After": "60" } });
    }
    const session = await auth().catch(() => null);
    const facets = await getSearchFacets({ signedIn: Boolean(session?.user) });
    return NextResponse.json(facets, { headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}
