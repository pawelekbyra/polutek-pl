import { z } from "zod";
import { createContentReport, REPORT_REASONS } from "@/lib/modules/channel";
import { readStudioJson, studioResult, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

const reportSchema = z
  .object({
    targetType: z.enum(["VIDEO", "CHANNEL"]),
    targetId: z.string().min(1).max(100),
    reason: z.enum(REPORT_REASONS),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();

/** A signed-in viewer reports a video or a channel. Session and CSRF are enforced in middleware.ts (/api/user/). */
export async function POST(request: Request) {
  return withStudio(request, { channel: false }, async ({ ctx }) => {
    const body = await readStudioJson(request, reportSchema);
    if (!body.ok) return body.response;
    return studioResult(await createContentReport(ctx, body.data), 201);
  });
}
