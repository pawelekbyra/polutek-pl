import { createPlaylist, listStudioPlaylists } from "@/lib/modules/playlists";
import { createPlaylistSchema } from "@/lib/api/studio-playlist-schemas";
import { enforceStudioRateLimit } from "@/lib/api/studio-rate-limit";
import { readStudioJson, studioResult, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

/** The channel's playlists (latest change first), with video counts. */
export async function GET(request: Request) {
  return withStudio(request, { channel: true }, async ({ ctx, userId, channel }) => {
    const limited = await enforceStudioRateLimit(userId, "playlists-read", 120);
    if (limited) return limited;
    return studioResult(await listStudioPlaylists(ctx, { channelId: channel!.id }));
  });
}

/** Creates a playlist; the slug comes from the title and is unique within the channel. */
export async function POST(request: Request) {
  return withStudio(request, { channel: true }, async ({ ctx, userId, channel }) => {
    const limited = await enforceStudioRateLimit(userId, "playlists-write", 30);
    if (limited) return limited;
    const body = await readStudioJson(request, createPlaylistSchema);
    if (!body.ok) return body.response;
    return studioResult(await createPlaylist(ctx, { channelId: channel!.id, ...body.data }), 201);
  });
}
