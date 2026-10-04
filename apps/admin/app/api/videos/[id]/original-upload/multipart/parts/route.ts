import { presignOriginalParts } from "@/lib/modules/video-pipeline";
import { adminMultipartPartsSchema } from "@/lib/api/admin-schemas";
import { panelRouteContext, readJson, resultResponse, unauthorizedJson, sampleDataResponse } from "@admin/lib/api/panel-route";

export const dynamic = "force-dynamic";

/** Short-lived presigned PUT URLs for a batch of parts (the browser uploads straight to R2). */
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const ctx = await panelRouteContext(request);
  if (!ctx) return unauthorizedJson();
  const sample = sampleDataResponse();
  if (sample) return sample;
  const { id } = await props.params;
  const body = await readJson(request, adminMultipartPartsSchema);
  if (!body.ok) return body.response;
  return resultResponse(await presignOriginalParts({ videoId: id, ...body.data }, ctx));
}
