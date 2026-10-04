import { getThumbnailSource } from "@/lib/modules/admin-content";
import { PRIVATE_THUMBNAIL_CACHE_CONTROL, ThumbnailResponseService, resolveVideoThumbnailUrl } from "@/lib/modules/media";
import { panelRouteContext } from "@admin/lib/api/panel-route";
import { isDevFixturesEnabled } from "@admin/lib/config";

export const dynamic = "force-dynamic";

/**
 * The panel's own cover preview (drafts included): streamed from storage on this origin, so the CSP keeps
 * `img-src 'self'`. Always private. A film without a cover (or with a site-relative default like
 * /logo.png, which lives on www) gets a neutral placeholder instead of a broken image.
 */
const PLACEHOLDER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><rect width="160" height="90" fill="#8a8882" opacity="0.18"/><path d="M68 32v26l22-13z" fill="#8a8882" opacity="0.55"/></svg>`;

const placeholder = () =>
  new Response(PLACEHOLDER, { status: 200, headers: { "content-type": "image/svg+xml", "cache-control": PRIVATE_THUMBNAIL_CACHE_CONTROL, "x-thumbnail": "placeholder" } });

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const ctx = await panelRouteContext(request);
  if (!ctx) return new Response(null, { status: 401 });
  if (isDevFixturesEnabled()) return placeholder();
  const { id } = await props.params;
  const source = await getThumbnailSource(id, ctx).catch(() => null);
  if (!source) return new Response(null, { status: 404 });
  const url = await resolveVideoThumbnailUrl(source.thumbnailUrl).catch(() => null);
  if (!url || url.startsWith("/")) return placeholder();
  const res = await ThumbnailResponseService.getThumbnailResponse(id, url, PRIVATE_THUMBNAIL_CACHE_CONTROL);
  return res.ok ? res : placeholder();
}
