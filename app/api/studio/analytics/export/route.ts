import { exportChannelAnalyticsCsv } from "@/lib/modules/creator-analytics";
import { describeError, studioError, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

/**
 * CSV download of the channel analytics: `?range=7|28|90&kind=videos|daily`. Attachment, never cached, capped at
 * a fixed number of rows (`X-Rows-Truncated: 1` when the cap cut the data).
 */
export async function GET(request: Request) {
  return withStudio(request, { channel: true }, async ({ ctx }) => {
    const params = new URL(request.url).searchParams;
    const result = await exportChannelAnalyticsCsv(ctx, { range: params.get("range"), kind: params.get("kind") });
    if (!result.ok) {
      const { status, message, code } = describeError(result.error);
      return studioError(status, message, code);
    }
    return new Response(result.data.csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${result.data.filename}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        ...(result.data.truncated ? { "x-rows-truncated": "1" } : {}),
      },
    });
  });
}
