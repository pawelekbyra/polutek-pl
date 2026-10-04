import { revalidatePath } from "next/cache";
import { COVER_MAX_BYTES, uploadVideoCover } from "@/lib/modules/admin-content";
import { panelRouteContext, readUploadedFile, resultResponse, unauthorizedJson, sampleDataResponse } from "@admin/lib/api/panel-route";

export const dynamic = "force-dynamic";

/** New cover: JPG/PNG/WebP up to 5 MB, checked by magic bytes, stored in the private R2 bucket. */
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const ctx = await panelRouteContext(request);
  if (!ctx) return unauthorizedJson();
  const sample = sampleDataResponse();
  if (sample) return sample;
  const { id } = await props.params;
  const file = await readUploadedFile(request, "file", COVER_MAX_BYTES);
  if (!file.ok) return file.response;
  const result = await uploadVideoCover({ videoId: id, bytes: file.bytes }, ctx);
  if (result.ok) revalidatePath("/tresci", "layout");
  return resultResponse(result);
}
