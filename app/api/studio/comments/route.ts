import { getModerationCounts, listPanelComments } from "@/lib/modules/comments";
import { studioCommentsQuerySchema } from "@/lib/api/studio-schemas";
import { studioError, studioJson, studioResult, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

/** Comments under the channel's videos (always scoped to the user's own channel) plus the queue counters. */
export async function GET(request: Request) {
  return withStudio(request, { channel: true }, async ({ ctx, channel }) => {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const parsed = studioCommentsQuerySchema.safeParse(params);
    if (!parsed.success) return studioError(400, "Niepoprawne żądanie.", "BAD_REQUEST");
    const { q, status, videoId, reported, page } = parsed.data;
    const list = await listPanelComments(ctx, { q, status, videoId, reported: reported ? true : undefined, page, channelId: channel!.id });
    if (!list.ok) return studioResult(list);
    const counts = await getModerationCounts(ctx, { channelId: channel!.id });
    return studioJson({ ...list.data, counts: counts.ok ? counts.data : null });
  });
}
