import { gateMode } from "@/lib/platform-gates";
import { getChannelLimitsView } from "@/lib/modules/video-pipeline";
import { studioJson, withStudio } from "@/lib/api/studio-route";

export const dynamic = "force-dynamic";

/**
 * Who the Studio is for: the signed-in user, their channels and whether they may create one, plus the current
 * channel's upload limits (read only; `null` for a channel without limits of its own). A failed limits lookup
 * never breaks the Studio: it just shows no limit.
 */
export async function GET(request: Request) {
  return withStudio(request, { channel: false }, async ({ ctx, channel, channels }) => {
    let limits: Awaited<ReturnType<typeof getChannelLimitsView>> = null;
    if (channel) {
      try {
        limits = (await getChannelLimitsView(ctx, channel.id)) ?? null;
      } catch {
        limits = null;
      }
    }
    return studioJson({ channel, channels, channelCreation: gateMode("channelCreation"), limits });
  });
}
