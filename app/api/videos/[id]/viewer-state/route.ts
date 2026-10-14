import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { auth } from "@/lib/auth/server";
import { getVideoInteraction } from "@/lib/modules/users";
import { getVideoProgressSeconds } from "@/lib/modules/watch-progress";
import { createAppContext } from "@/lib/modules/shared/app-context";

export const dynamic = "force-dynamic";

// Per-viewer data: never cache on a CDN or share between viewers.
const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * The signed-in viewer's own like/dislike and saved position (resume watching) for one video. The home page renders
 * this server-side only for the video it opened with; after a shallow in-page
 * video switch, Hero fetches it here instead of re-rendering the whole page.
 */
export async function GET(_req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id: videoId } = await props.params;
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ liked: false, disliked: false, progressSeconds: null }, { headers: NO_STORE });
    }
    const [interaction, progressSeconds] = await Promise.all([
      getVideoInteraction(userId, videoId),
      getVideoProgressSeconds(userId, videoId, createAppContext()).catch(() => null),
    ]);
    return NextResponse.json({ ...interaction, progressSeconds }, { headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}
