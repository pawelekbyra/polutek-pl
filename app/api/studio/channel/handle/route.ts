import { changeChannelHandle, checkHandleAvailability } from "@/lib/modules/channel";
import { changeHandleSchema } from "@/lib/api/studio-schemas";
import { readStudioJson, studioError, studioJson, studioResult, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

/** `?handle=` availability with suggestions; usable before the user has a channel. */
export async function GET(request: Request) {
  return withStudio(request, { channel: false }, async ({ ctx, channel }) => {
    const handle = new URL(request.url).searchParams.get("handle");
    if (!handle) return studioError(400, "Podaj uchwyt.", "BAD_REQUEST");
    return studioJson(await checkHandleAvailability(ctx, handle, { exceptChannelId: channel?.id }));
  });
}

/** Changes the @handle (at most twice in 14 days; the old one stays reserved and redirects). */
export async function PUT(request: Request) {
  return withStudio(request, { channel: true }, async ({ ctx }) => {
    const body = await readStudioJson(request, changeHandleSchema);
    if (!body.ok) return body.response;
    return studioResult(await changeChannelHandle(ctx, body.data.handle));
  });
}
