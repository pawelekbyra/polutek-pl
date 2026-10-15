import { banViewerFromChannel, listChannelBans, unbanViewerFromChannel } from "@/lib/modules/comments";
import { channelBanSchema, channelUnbanSchema } from "@/lib/api/studio-schemas";
import { readStudioJson, studioResult, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

/** The channel's block list (viewers who cannot comment under its videos). */
export async function GET(request: Request) {
  return withStudio(request, { channel: true }, async ({ ctx, channel }) => {
    return studioResult(await listChannelBans(ctx, { channelId: channel!.id }));
  });
}

/** Blocks a viewer, optionally until a date, with a reason only the channel sees. */
export async function POST(request: Request) {
  return withStudio(request, { channel: true }, async ({ ctx, channel }) => {
    const body = await readStudioJson(request, channelBanSchema);
    if (!body.ok) return body.response;
    const { userId, until, reason } = body.data;
    return studioResult(await banViewerFromChannel(ctx, { channelId: channel!.id, userId, until: until ? new Date(until) : null, reason: reason ?? null }), 201);
  });
}

/** Lifts a block. */
export async function DELETE(request: Request) {
  return withStudio(request, { channel: true }, async ({ ctx, channel }) => {
    const body = await readStudioJson(request, channelUnbanSchema);
    if (!body.ok) return body.response;
    return studioResult(await unbanViewerFromChannel(ctx, { channelId: channel!.id, userId: body.data.userId }));
  });
}
