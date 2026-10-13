import { presignOriginalParts } from "@/lib/modules/video-pipeline";
import { adminMultipartPartsSchema } from "@/lib/api/admin-schemas";
import { readStudioJson, studioResult, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Presigned PUT addresses for a batch of parts (asked in batches so they stay fresh on long uploads). */
export async function POST(request: Request, props: Params) {
  return withStudio(request, { channel: true }, async ({ ctx }) => {
    const { id } = await props.params;
    const body = await readStudioJson(request, adminMultipartPartsSchema);
    if (!body.ok) return body.response;
    return studioResult(await presignOriginalParts({ videoId: id, ...body.data }, ctx));
  });
}
