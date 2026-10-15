import { listDecisionsForCreator } from "@/lib/modules/channel";
import { studioJson, studioResult, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

/**
 * Moderation decisions about the user's channel and its videos (DSA art. 17): the public statement of reasons, the
 * appeal state and whether an appeal is still possible. Internal notes are never part of the response.
 */
export async function GET(request: Request) {
  return withStudio(request, { channel: true }, async ({ ctx, channel }) => {
    const res = await listDecisionsForCreator(ctx, { channelId: channel!.id });
    return res.ok ? studioJson(res.data) : studioResult(res);
  });
}
