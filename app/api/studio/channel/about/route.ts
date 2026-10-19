import { getChannelAboutSettings, updateChannelAbout } from "@/lib/modules/channel";
import { updateChannelAboutSchema } from "@/lib/api/studio-schemas";
import { readStudioJson, studioResult, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

/** About links, public contact e-mail and banner address of the current channel. */
export async function GET(request: Request) {
  return withStudio(request, { channel: true }, async ({ ctx }) => studioResult(await getChannelAboutSettings(ctx)));
}

/** Replaces the links and/or the public contact e-mail (OWNER or MANAGER only, checked in the use case). */
export async function PATCH(request: Request) {
  return withStudio(request, { channel: true }, async ({ ctx }) => {
    const body = await readStudioJson(request, updateChannelAboutSchema);
    if (!body.ok) return body.response;
    return studioResult(await updateChannelAbout(ctx, body.data));
  });
}
