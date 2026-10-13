import { cancelEncode, getPipelineState } from "@/lib/modules/video-pipeline";
import { studioError, studioResult, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Upload, queue and encoding state of one video (what the Studio shows next to it). */
export async function GET(request: Request, props: Params) {
  return withStudio(request, { channel: true }, async ({ ctx }) => {
    const { id } = await props.params;
    return studioResult(await getPipelineState({ videoId: id }, ctx));
  });
}

/** Cancels a queued or running encode job (`?jobId=`). */
export async function DELETE(request: Request, props: Params) {
  return withStudio(request, { channel: true }, async ({ ctx }) => {
    const { id } = await props.params;
    const jobId = new URL(request.url).searchParams.get("jobId");
    if (!jobId) return studioError(400, "Brak jobId.", "BAD_REQUEST");
    return studioResult(await cancelEncode({ videoId: id, jobId }, ctx));
  });
}
