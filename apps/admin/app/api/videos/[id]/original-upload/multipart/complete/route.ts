import { completeOriginalMultipart } from "@/lib/modules/video-pipeline";
import { ADMIN_MULTIPART_COMPLETE_BODY_MAX_BYTES, adminMultipartCompleteSchema } from "@/lib/api/admin-schemas";
import { panelRouteContext, readJson, resultResponse, unauthorizedJson, sampleDataResponse } from "@admin/lib/api/panel-route";

export const dynamic = "force-dynamic";

/** Finishes the upload: the server verifies size and magic bytes, then queues encoding. */
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const ctx = await panelRouteContext(request);
  if (!ctx) return unauthorizedJson();
  const sample = sampleDataResponse();
  if (sample) return sample;
  const { id } = await props.params;
  const body = await readJson(request, adminMultipartCompleteSchema, ADMIN_MULTIPART_COMPLETE_BODY_MAX_BYTES);
  if (!body.ok) return body.response;
  return resultResponse(await completeOriginalMultipart({ videoId: id, ...body.data }, ctx));
}
