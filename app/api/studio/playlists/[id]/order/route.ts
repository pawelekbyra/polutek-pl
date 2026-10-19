import { reorderPlaylist } from "@/lib/modules/playlists";
import { playlistOrderSchema } from "@/lib/api/studio-playlist-schemas";
import { enforceStudioRateLimit } from "@/lib/api/studio-rate-limit";
import { readStudioJson, studioResult, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Replaces the whole order in one transaction; the body must name exactly the videos the playlist holds (409 otherwise). */
export async function PUT(request: Request, { params }: RouteContext) {
  const { id } = await params;
  return withStudio(request, { channel: true }, async ({ ctx, userId, channel }) => {
    const limited = await enforceStudioRateLimit(userId, "playlists-write", 60);
    if (limited) return limited;
    const body = await readStudioJson(request, playlistOrderSchema);
    if (!body.ok) return body.response;
    return studioResult(await reorderPlaylist(ctx, { channelId: channel!.id, playlistId: id, videoIds: body.data.videoIds }));
  });
}
