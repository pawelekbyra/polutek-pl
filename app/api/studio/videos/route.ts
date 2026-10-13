import { randomBytes } from "node:crypto";
import { slugify } from "@/lib/modules/admin-content";
import { createAdminVideo, getAdminVideoList } from "@/lib/modules/video";
import { STUDIO_VIDEO_ORDER_BY, createVideoSchema, studioVideosQuerySchema } from "@/lib/api/studio-schemas";
import { readStudioJson, studioError, studioResult, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

/** The channel's videos. Optional `q` (title/slug), `status` (DRAFT|PUBLISHED|UNLISTED|ARCHIVED), `sort` (newest|views). */
export async function GET(request: Request) {
  return withStudio(request, { channel: true }, async ({ ctx }) => {
    const params = new URL(request.url).searchParams;
    const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(params.get("limit") ?? "20", 10) || 20));
    const filters = studioVideosQuerySchema.safeParse({
      q: params.get("q") || undefined,
      status: params.get("status") || undefined,
      sort: params.get("sort") || undefined,
    });
    if (!filters.success) return studioError(400, "Niepoprawne żądanie.", "BAD_REQUEST");
    const { q, status, sort } = filters.data;
    return studioResult(
      await getAdminVideoList(
        { page, limit, query: q || undefined, status, ...(sort ? { orderBy: STUDIO_VIDEO_ORDER_BY[sort] } : {}) },
        ctx,
      ),
    );
  });
}

/** Creates a draft. The slug is the title plus a short random suffix: globally unique without a round trip. */
export async function POST(request: Request) {
  return withStudio(request, { channel: true }, async ({ ctx }) => {
    const body = await readStudioJson(request, createVideoSchema);
    if (!body.ok) return body.response;
    const base = slugify(body.data.title) || "film";
    const slug = `${base}-${randomBytes(3).toString("hex")}`;
    return studioResult(
      await createAdminVideo(
        {
          title: body.data.title,
          titleEn: body.data.titleEn ?? null,
          description: body.data.description ?? null,
          descriptionEn: body.data.descriptionEn ?? null,
          tier: body.data.tier ?? "PUBLIC",
          publishAfterAssetReady: body.data.publishAfterAssetReady === true,
          premiereAt: body.data.premiereAt ? new Date(body.data.premiereAt) : null,
          ...(body.data.tags !== undefined ? { tags: body.data.tags } : {}),
          ...(body.data.category !== undefined ? { category: body.data.category } : {}),
          ...(body.data.commentsMode !== undefined ? { commentsMode: body.data.commentsMode } : {}),
          slug,
        },
        ctx,
      ),
      201,
    );
  });
}
