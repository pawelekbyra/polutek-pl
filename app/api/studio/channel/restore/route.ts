import { restoreChannel } from "@/lib/modules/channel";
import { restoreChannelSchema } from "@/lib/api/studio-schemas";
import { readStudioJson, studioResult, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

/** Undoes the owner's own channel deletion while the grace period lasts. */
export async function POST(request: Request) {
  return withStudio(request, { channel: false }, async ({ ctx }) => {
    const body = await readStudioJson(request, restoreChannelSchema);
    if (!body.ok) return body.response;
    return studioResult(await restoreChannel(ctx, body.data.channelId));
  });
}
