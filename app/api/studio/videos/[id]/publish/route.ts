import { archiveAdminVideo, cancelAutoPublish, publishAdminVideo, unlistAdminVideo, unpublishAdminVideo } from "@/lib/modules/video";
import { publishVideoSchema } from "@/lib/api/studio-schemas";
import { readStudioJson, studioResult, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** `{ action: "publish" | "unlist" | "unpublish" | "archive" | "cancel_auto_publish" }`. Publication blockers come back as 4xx with their reason. */
export async function POST(request: Request, props: Params) {
  return withStudio(request, { channel: true }, async ({ ctx }) => {
    const { id } = await props.params;
    const body = await readStudioJson(request, publishVideoSchema);
    if (!body.ok) return body.response;
    const { action } = body.data;
    if (action === "cancel_auto_publish") return studioResult(await cancelAutoPublish(id, ctx));
    if (action === "unpublish") return studioResult(await unpublishAdminVideo(id, ctx));
    if (action === "unlist") return studioResult(await unlistAdminVideo(id, ctx));
    return studioResult(action === "publish" ? await publishAdminVideo(id, ctx) : await archiveAdminVideo(id, ctx));
  });
}
