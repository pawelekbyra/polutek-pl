import { deleteVideoWithStorage } from "@/lib/modules/admin-content";
import { getAdminVideoDetails, updateAdminVideo } from "@/lib/modules/video";
import { updateVideoSchema } from "@/lib/api/studio-schemas";
import { readStudioJson, studioJson, studioResult, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** One video with its diagnostics. The audit trail is platform business and is not part of the Studio. */
export async function GET(request: Request, props: Params) {
  return withStudio(request, { channel: true }, async ({ ctx }) => {
    const { id } = await props.params;
    const result = await getAdminVideoDetails({ idOrSlug: id }, ctx);
    if (!result.ok) return studioResult(result);
    const { auditLogs: _auditLogs, ...video } = result.data;
    return studioJson(video);
  });
}

/** Edits the fields a creator may set (see studio-schemas). Publishing and archiving have their own route. */
export async function PATCH(request: Request, props: Params) {
  return withStudio(request, { channel: true }, async ({ ctx }) => {
    const { id } = await props.params;
    const body = await readStudioJson(request, updateVideoSchema);
    if (!body.ok) return body.response;
    const { premiereAt, ...rest } = body.data;
    return studioResult(
      await updateAdminVideo(
        { id, ...rest, ...(premiereAt !== undefined ? { premiereAt: premiereAt === null ? null : new Date(premiereAt) } : {}) },
        ctx,
      ),
    );
  });
}

/** Deletes the video and everything it owns in storage. */
export async function DELETE(request: Request, props: Params) {
  return withStudio(request, { channel: true }, async ({ ctx }) => {
    const { id } = await props.params;
    return studioResult(await deleteVideoWithStorage(id, ctx));
  });
}
