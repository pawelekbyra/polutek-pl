import { completeOriginalMultipart } from "@/lib/modules/video-pipeline";
import { ADMIN_MULTIPART_COMPLETE_BODY_MAX_BYTES, adminMultipartCompleteSchema } from "@/lib/api/admin-schemas";
import { readStudioJson, studioResult, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Closes the upload, verifies the real object (size, container) and queues the encoding. */
export async function POST(request: Request, props: Params) {
  return withStudio(request, { channel: true }, async ({ ctx }) => {
    const { id } = await props.params;
    const body = await readStudioJson(request, adminMultipartCompleteSchema, ADMIN_MULTIPART_COMPLETE_BODY_MAX_BYTES);
    if (!body.ok) return body.response;
    return studioResult(await completeOriginalMultipart({ videoId: id, ...body.data }, ctx));
  });
}
