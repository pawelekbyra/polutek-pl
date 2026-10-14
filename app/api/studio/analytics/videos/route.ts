import { getChannelVideoAnalytics } from "@/lib/modules/creator-analytics";
import { studioResult, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

/** Per-video table of the channel for `?range=7|28|90`. */
export async function GET(request: Request) {
  return withStudio(request, { channel: true }, async ({ ctx }) => {
    const range = new URL(request.url).searchParams.get("range");
    return studioResult(await getChannelVideoAnalytics(ctx, { range }));
  });
}
