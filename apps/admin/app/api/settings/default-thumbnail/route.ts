import { revalidatePath } from "next/cache";
import { COVER_MAX_BYTES, getDefaultThumbnailState, setDefaultThumbnail } from "@/lib/modules/admin-content";
import { PRIVATE_THUMBNAIL_CACHE_CONTROL, ThumbnailResponseService } from "@/lib/modules/media";
import { allowAction, RATE } from "@admin/lib/actions/rate-limit";
import { jsonError, panelRouteContext, readUploadedFile, resultResponse, sampleDataResponse, unauthorizedJson } from "@admin/lib/api/panel-route";
import { isDevFixturesEnabled } from "@admin/lib/config";

export const dynamic = "force-dynamic";

const PLACEHOLDER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><rect width="160" height="90" fill="#8a8882" opacity="0.18"/><path d="M68 32v26l22-13z" fill="#8a8882" opacity="0.55"/></svg>`;
const placeholder = () => new Response(PLACEHOLDER, { status: 200, headers: { "content-type": "image/svg+xml", "cache-control": "private, no-store", "x-thumbnail": "placeholder" } });

/** Preview of the default thumbnail on the panel's own origin (CSP `img-src 'self'`). */
export async function GET(request: Request) {
  const ctx = await panelRouteContext(request);
  if (!ctx) return new Response(null, { status: 401 });
  if (isDevFixturesEnabled()) return placeholder();
  const state = await getDefaultThumbnailState(ctx).catch(() => null);
  const url = state?.storageUrl;
  if (!url) return placeholder();
  const res = await ThumbnailResponseService.getThumbnailResponse("default-thumbnail", url, PRIVATE_THUMBNAIL_CACHE_CONTROL);
  return res.ok ? res : placeholder();
}

/** New default thumbnail: JPG/PNG/WebP up to 5 MB, magic bytes checked, private R2 bucket, old file removed after. */
export async function POST(request: Request) {
  const ctx = await panelRouteContext(request);
  if (!ctx || ctx.actor.type !== "admin") return unauthorizedJson();
  const sample = sampleDataResponse();
  if (sample) return sample;
  if (!allowAction(ctx.actor.userId, RATE.upload)) return jsonError(429, "Za dużo wgrań. Spróbuj za minutę.", "RATE_LIMITED");
  const file = await readUploadedFile(request, "file", COVER_MAX_BYTES);
  if (!file.ok) return file.response;
  const result = await setDefaultThumbnail({ bytes: file.bytes }, ctx);
  if (result.ok) revalidatePath("/ustawienia");
  return resultResponse(result);
}
