import { archiveAdminVideo, publishAdminVideo } from "@/lib/modules/video";
import { publishVideoSchema } from "@/lib/api/studio-schemas";
import { readStudioJson, studioResult, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** `{ action: "publish" | "archive" }`. Publication blockers come back as 4xx with their reason. */
export async function POST(request: Request, props: Params) {
  return withStudio(request, { channel: true }, async ({ ctx }) => {
    const { id } = await props.params;
    const body = await readStudioJson(request, publishVideoSchema);
    if (!body.ok) return body.response;
    return studioResult(body.data.action === "publish" ? await publishAdminVideo(id, ctx) : await archiveAdminVideo(id, ctx));
  });
}
