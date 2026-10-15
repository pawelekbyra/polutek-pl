import { createModerationAppeal } from "@/lib/modules/channel";
import { moderationAppealSchema } from "@/lib/api/studio-schemas";
import { readStudioJson, studioResult, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ decisionId: string }> };

/** Appeals one decision of the channel (once, within six months). The use case authorizes against the decision's channel. */
export async function POST(request: Request, props: Params) {
  return withStudio(request, { channel: true }, async ({ ctx }) => {
    const { decisionId } = await props.params;
    const body = await readStudioJson(request, moderationAppealSchema);
    if (!body.ok) return body.response;
    return studioResult(await createModerationAppeal(ctx, { decisionId, text: body.data.text }), 201);
  });
}
