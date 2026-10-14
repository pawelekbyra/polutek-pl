import { gateMode } from "@/lib/platform-gates";
import { studioJson, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

/** Who the Studio is for: the signed-in user, their channels and whether they may create one. */
export async function GET(request: Request) {
  return withStudio(request, { channel: false }, async ({ channel, channels }) =>
    studioJson({ channel, channels, channelCreation: gateMode("channelCreation") }),
  );
}
