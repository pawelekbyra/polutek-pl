import { cancelEncode, getPipelineState } from "@/lib/modules/video-pipeline";
import { studioError, studioJson, studioResult, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Upload, queue and encoding state of one video (what the Studio shows next to it). */
export async function GET(request: Request, props: Params) {
  return withStudio(request, { channel: true }, async ({ ctx }) => {
    const { id } = await props.params;
    const result = await getPipelineState({ videoId: id }, ctx);
    if (!result.ok) return studioResult(result);
    // Storage object keys and internal ids are platform business: the creator sees state, not paths.
    const { assets, original, ...rest } = result.data;
    return studioJson({
      ...rest,
      original: original ? { status: original.status, fileName: original.fileName, sizeBytes: original.sizeBytes, failureReason: original.failureReason } : null,
      assets: assets.map((a) => ({ versionNumber: a.versionNumber, isActive: a.isActive, sizeBytes: a.sizeBytes, createdAt: a.createdAt })),
    });
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
