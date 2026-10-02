import { NextRequest, NextResponse } from "next/server";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { getUserAvatar } from "@/lib/modules/users";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ userId: string }> };

/**
 * Public avatar image (shown next to comments). The URL carries a version query that changes with
 * every upload, so the response can be cached for a year. Deleted accounts and unknown ids are 404.
 */
export async function GET(_request: NextRequest, { params }: Context) {
  const { userId } = await params;
  const avatar = await getUserAvatar(createAppContext({ type: "guest" }), userId);

  if (!avatar) {
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "public, max-age=60" } });
  }

  return new NextResponse(new Uint8Array(avatar.data), {
    status: 200,
    headers: {
      "Content-Type": avatar.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
