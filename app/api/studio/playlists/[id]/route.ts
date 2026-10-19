import { deletePlaylist, getStudioPlaylist, updatePlaylist } from "@/lib/modules/playlists";
import { updatePlaylistSchema } from "@/lib/api/studio-playlist-schemas";
import { enforceStudioRateLimit } from "@/lib/api/studio-rate-limit";
import { readStudioJson, studioResult, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** One playlist with all its items (each flagged when viewers would not see it today). */
export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params;
  return withStudio(request, { channel: true }, async ({ ctx, userId, channel }) => {
    const limited = await enforceStudioRateLimit(userId, "playlists-read", 120);
    if (limited) return limited;
    return studioResult(await getStudioPlaylist(ctx, { channelId: channel!.id, playlistId: id, channelSlug: channel!.slug }));
  });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  return withStudio(request, { channel: true }, async ({ ctx, userId, channel }) => {
    const limited = await enforceStudioRateLimit(userId, "playlists-write", 30);
    if (limited) return limited;
    const body = await readStudioJson(request, updatePlaylistSchema);
    if (!body.ok) return body.response;
    return studioResult(await updatePlaylist(ctx, { channelId: channel!.id, playlistId: id, ...body.data }));
  });
}

/** Soft delete (the slug stays reserved). */
export async function DELETE(request: Request, { params }: RouteContext) {
  const { id } = await params;
  return withStudio(request, { channel: true }, async ({ ctx, userId, channel }) => {
    const limited = await enforceStudioRateLimit(userId, "playlists-write", 30);
    if (limited) return limited;
    return studioResult(await deletePlaylist(ctx, { channelId: channel!.id, playlistId: id }));
  });
}
