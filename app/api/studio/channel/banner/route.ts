import { setChannelBanner } from "@/lib/modules/channel";
import { setChannelBannerSchema } from "@/lib/api/studio-schemas";
import { readStudioJson, studioError, studioResult, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

/** Stores the browser-cropped 4:1 banner (validated again on the server). */
export async function PUT(request: Request) {
  return withStudio(request, { channel: true }, async ({ ctx }) => {
    const body = await readStudioJson(request, setChannelBannerSchema);
    if (!body.ok) return body.response;
    if (body.data.dataUrl === null) return studioError(400, "Niepoprawne żądanie.", "BAD_REQUEST");
    return studioResult(await setChannelBanner(ctx, { dataUrl: body.data.dataUrl }));
  });
}

/** Removes the banner. */
export async function DELETE(request: Request) {
  return withStudio(request, { channel: true }, async ({ ctx }) => studioResult(await setChannelBanner(ctx, { dataUrl: null })));
}
