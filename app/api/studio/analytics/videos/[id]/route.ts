import { getChannelVideoDetail } from "@/lib/modules/creator-analytics";
import { studioResult, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** One video of the channel: daily series, reach curve, viewer-type split. A foreign video is 404. */
export async function GET(request: Request, props: Params) {
  return withStudio(request, { channel: true }, async ({ ctx }) => {
    const { id } = await props.params;
    const range = new URL(request.url).searchParams.get("range");
    return studioResult(await getChannelVideoDetail(ctx, { videoId: id, range }));
  });
}
