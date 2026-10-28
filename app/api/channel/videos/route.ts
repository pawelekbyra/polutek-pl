import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { listPublicChannelVideos } from "@/lib/modules/channel";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * The next page of a publicly visible channel's videos ("More" on the channel page, W04), in the page's order.
 * Public on purpose (middleware.ts): the same videos the channel page lists. A hidden, suspended or unknown channel
 * answers 404, the same for all of them.
 */
export async function GET(req: NextRequest) {
  try {
    const channelId = req.nextUrl.searchParams.get("channelId") ?? "";
    const offsetParam = req.nextUrl.searchParams.get("offset") ?? "0";
    if (!channelId || channelId.length > 100 || !/^\d{1,7}$/.test(offsetParam)) {
      return NextResponse.json({ error: "Bad request" }, { status: 400, headers: NO_STORE });
    }
    const page = await listPublicChannelVideos(channelId, Number(offsetParam));
    if (!page) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
    return NextResponse.json(page, { headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}
