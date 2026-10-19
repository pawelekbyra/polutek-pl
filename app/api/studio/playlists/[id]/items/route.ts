import { addPlaylistVideo, removePlaylistVideo } from "@/lib/modules/playlists";
import { playlistVideoSchema } from "@/lib/api/studio-playlist-schemas";
import { enforceStudioRateLimit } from "@/lib/api/studio-rate-limit";
import { readStudioJson, studioResult, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Adds a video of this channel to the end of the playlist. */
export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  return withStudio(request, { channel: true }, async ({ ctx, userId, channel }) => {
    const limited = await enforceStudioRateLimit(userId, "playlists-write", 60);
    if (limited) return limited;
    const body = await readStudioJson(request, playlistVideoSchema);
    if (!body.ok) return body.response;
    return studioResult(await addPlaylistVideo(ctx, { channelId: channel!.id, playlistId: id, videoId: body.data.videoId }), 201);
  });
}

/** Removes a video from the playlist. */
export async function DELETE(request: Request, { params }: RouteContext) {
  const { id } = await params;
  return withStudio(request, { channel: true }, async ({ ctx, userId, channel }) => {
    const limited = await enforceStudioRateLimit(userId, "playlists-write", 60);
    if (limited) return limited;
    const body = await readStudioJson(request, playlistVideoSchema);
    if (!body.ok) return body.response;
    return studioResult(await removePlaylistVideo(ctx, { channelId: channel!.id, playlistId: id, videoId: body.data.videoId }));
  });
}
