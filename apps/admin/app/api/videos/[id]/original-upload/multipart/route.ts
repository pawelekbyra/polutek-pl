import { abortOriginalUpload, listOriginalParts, startOriginalUpload } from "@/lib/modules/video-pipeline";
import { adminMultipartStartSchema } from "@/lib/api/admin-schemas";
import { jsonError, panelRouteContext, readJson, resultResponse, unauthorizedJson, sampleDataResponse } from "@admin/lib/api/panel-route";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Opens a resumable multipart upload of the ORIGINAL file to the private R2 bucket (same use case as www). */
export async function POST(request: Request, props: Params) {
  const ctx = await panelRouteContext(request);
  if (!ctx) return unauthorizedJson();
  const sample = sampleDataResponse();
  if (sample) return sample;
  const { id } = await props.params;
  const body = await readJson(request, adminMultipartStartSchema);
  if (!body.ok) return body.response;
  return resultResponse(await startOriginalUpload({ videoId: id, ...body.data }, ctx));
}

/** Parts R2 already holds, so a reloaded page resumes instead of starting over. */
export async function GET(request: Request, props: Params) {
  const ctx = await panelRouteContext(request);
  if (!ctx) return unauthorizedJson();
  const sample = sampleDataResponse();
  if (sample) return sample;
  const { id } = await props.params;
  const originalId = new URL(request.url).searchParams.get("originalId");
  if (!originalId) return jsonError(400, "Brak originalId.", "BAD_REQUEST");
  return resultResponse(await listOriginalParts({ videoId: id, originalId }, ctx));
}

/** Aborts an unfinished upload (R2 drops the uploaded parts). */
export async function DELETE(request: Request, props: Params) {
  const ctx = await panelRouteContext(request);
  if (!ctx) return unauthorizedJson();
  const sample = sampleDataResponse();
  if (sample) return sample;
  const { id } = await props.params;
  const originalId = new URL(request.url).searchParams.get("originalId");
  if (!originalId) return jsonError(400, "Brak originalId.", "BAD_REQUEST");
  return resultResponse(await abortOriginalUpload({ videoId: id, originalId }, ctx));
}
