import { AppContext } from "@/lib/modules/shared/app-context";
import { MainChannelService } from "@/lib/modules/channel";

/**
 * The channel a subscription action is about. An explicit `creatorId` must be a publicly visible channel
 * (a hidden or missing one is a 404); without it the platform's main channel is used (back-compat, CLAUDE.md 4.24).
 */
export async function resolveSubscribableChannel(ctx: AppContext, creatorId?: string | null) {
  return creatorId
    ? await MainChannelService.getPubliclyVisibleById(ctx, creatorId)
    : await MainChannelService.getRequired(ctx);
}

/** Same, for leaving a channel: a channel that is no longer public can still be left. */
export async function resolveLeavableChannel(ctx: AppContext, creatorId?: string | null) {
  return creatorId
    ? await MainChannelService.getAnyById(ctx, creatorId)
    : await MainChannelService.getRequired(ctx);
}
