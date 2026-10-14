/**
 * Every backstage action that can be authorized (CLAUDE.md 4.23). Reading public content is not here: that is
 * `checkVideoAccess()` (CLAUDE.md 4.4). The list is closed on purpose: a new capability needs a new entry and a row in
 * `matrix.ts`, and the contract test fails until both exist.
 */
export const AUTHZ_ACTIONS = [
  // Channel
  "channel.create",
  "channel.update",
  "channel.delete",
  "channel.restore",
  "channel.manage_members",
  "channel.view_analytics",
  // Video content
  "video.create",
  "video.update",
  "video.upload",
  "video.publish",
  "video.delete",
  "video.reorder",
  "video.encode",
  "video.preview",
  "video.subtitles",
  "video.translate",
  "video.set_price",
  // Comments on the channel's videos
  "comment.moderate",
  "comment.pin",
  "comment.heart",
  "comment.reply_as_creator",
  // Money
  "payout.view",
  "payout.manage",
  // Platform staff only (admin panel)
  "platform.manage_channel",
  "platform.moderate_channel",
  "platform.suspend_channel",
  "platform.refund",
  "platform.view_all_channels",
  "platform.settings",
] as const;

export type AuthzAction = (typeof AUTHZ_ACTIONS)[number];

export function isPlatformAction(action: AuthzAction): boolean {
  return action.startsWith("platform.");
}
