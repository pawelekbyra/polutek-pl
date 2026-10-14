import { getChannelAnalyticsOverview } from "@/lib/modules/creator-analytics";
import { studioResult, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

/** Channel overview for `?range=7|28|90` (default 28): totals, subscriber flow and the daily series. */
export async function GET(request: Request) {
  return withStudio(request, { channel: true }, async ({ ctx }) => {
    const range = new URL(request.url).searchParams.get("range");
    return studioResult(await getChannelAnalyticsOverview(ctx, { range }));
  });
}
