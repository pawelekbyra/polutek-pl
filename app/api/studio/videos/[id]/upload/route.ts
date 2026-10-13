import { abortOriginalUpload, listOriginalParts, startOriginalUpload } from "@/lib/modules/video-pipeline";
import { adminMultipartStartSchema } from "@/lib/api/admin-schemas";
import { readStudioJson, studioError, studioResult, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Opens a resumable multipart upload of the ORIGINAL file to the private bucket; channel limits apply. */
export async function POST(request: Request, props: Params) {
  return withStudio(request, { channel: true }, async ({ ctx }) => {
    const { id } = await props.params;
    const body = await readStudioJson(request, adminMultipartStartSchema);
    if (!body.ok) return body.response;
    return studioResult(await startOriginalUpload({ videoId: id, ...body.data }, ctx));
  });
}

/** Parts the storage already holds, so a reloaded page resumes instead of starting over. */
export async function GET(request: Request, props: Params) {
  return withStudio(request, { channel: true }, async ({ ctx }) => {
    const { id } = await props.params;
    const originalId = new URL(request.url).searchParams.get("originalId");
    if (!originalId) return studioError(400, "Brak originalId.", "BAD_REQUEST");
    return studioResult(await listOriginalParts({ videoId: id, originalId }, ctx));
  });
}

/** Aborts an unfinished upload (the storage drops the uploaded parts). */
export async function DELETE(request: Request, props: Params) {
  return withStudio(request, { channel: true }, async ({ ctx }) => {
    const { id } = await props.params;
    const originalId = new URL(request.url).searchParams.get("originalId");
    if (!originalId) return studioError(400, "Brak originalId.", "BAD_REQUEST");
    return studioResult(await abortOriginalUpload({ videoId: id, originalId }, ctx));
  });
}
