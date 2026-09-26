import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { auth } from "@clerk/nextjs/server";
import { getVideoInteraction } from "@/lib/modules/users";

export const dynamic = "force-dynamic";

// Per-viewer data: never cache on a CDN or share between viewers.
const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * The signed-in viewer's own like/dislike for one video. The home page renders
 * this server-side only for the video it opened with; after a shallow in-page
 * video switch, Hero fetches it here instead of re-rendering the whole page.
 */
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id: videoId } = await props.params;
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ liked: false, disliked: false }, { headers: NO_STORE });
    }
    const interaction = await getVideoInteraction(userId, videoId);
    return NextResponse.json(interaction, { headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}
