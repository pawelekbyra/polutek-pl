import { getPipelineState } from "@/lib/modules/video-pipeline";
import { isDevFixturesEnabled } from "@admin/lib/config";
import { fixtureDetail } from "@admin/lib/content-fixtures";
import { jsonOk, panelRouteContext, resultResponse, unauthorizedJson } from "@admin/lib/api/panel-route";

export const dynamic = "force-dynamic";

/** Live state of upload and encoding for one film (polled by the film page while something runs). */
export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const ctx = await panelRouteContext(request);
  if (!ctx) return unauthorizedJson();
  const { id } = await props.params;
  if (isDevFixturesEnabled()) return jsonOk(fixtureDetail(id)?.pipeline ?? null);
  return resultResponse(await getPipelineState({ videoId: id }, ctx));
}
