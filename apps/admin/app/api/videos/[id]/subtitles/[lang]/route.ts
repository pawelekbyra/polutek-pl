import { revalidatePath } from "next/cache";
import { SUBTITLE_MAX_BYTES, uploadVideoSubtitle } from "@/lib/modules/admin-content";
import { jsonError, panelRouteContext, readUploadedFile, resultResponse, unauthorizedJson, sampleDataResponse } from "@admin/lib/api/panel-route";

export const dynamic = "force-dynamic";

/** WebVTT subtitles for one language (pl|en): validated, then served from the public R2 host. */
export async function POST(request: Request, props: { params: Promise<{ id: string; lang: string }> }) {
  const ctx = await panelRouteContext(request);
  if (!ctx) return unauthorizedJson();
  const sample = sampleDataResponse();
  if (sample) return sample;
  const { id, lang } = await props.params;
  if (lang !== "pl" && lang !== "en") return jsonError(404, "Nieznany język napisów.", "NOT_FOUND");
  const file = await readUploadedFile(request, "file", SUBTITLE_MAX_BYTES);
  if (!file.ok) return file.response;
  const result = await uploadVideoSubtitle({ videoId: id, lang, bytes: file.bytes }, ctx);
  if (result.ok) revalidatePath("/tresci", "layout");
  return resultResponse(result);
}
