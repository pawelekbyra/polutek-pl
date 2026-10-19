import { NextRequest, NextResponse } from "next/server";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getPublicChannelBanner } from "@/lib/modules/channel";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ channelId: string }> };

/**
 * Public channel banner image. The URL carries a version query that changes with every upload, so the response
 * can be cached for a year. Hidden, suspended and deleted channels and unknown ids are 404.
 */
export async function GET(_request: NextRequest, { params }: Context) {
  const { channelId } = await params;
  const banner = await getPublicChannelBanner(createAppContext({ actor: { type: "guest" } }), channelId);

  if (!banner) {
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "public, max-age=60" } });
  }

  return new NextResponse(new Uint8Array(banner.data), {
    status: 200,
    headers: {
      "Content-Type": banner.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
