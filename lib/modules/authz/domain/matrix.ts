import type { AuthzAction } from "./actions";
import type { ChannelRole, ChannelStatus } from "./resources";

const CONTENT_EDIT: readonly AuthzAction[] = [
  "video.create",
  "video.update",
  "video.upload",
  "video.publish",
  "video.reorder",
  "video.encode",
  "video.preview",
  "video.subtitles",
  "video.translate",
];

const COMMENT_MODERATION: readonly AuthzAction[] = ["comment.moderate", "comment.pin", "comment.heart"];

/** What each role may do inside its own channel. Staff and system are handled in `policy.ts`, not here. */
export const ROLE_ACTIONS: Readonly<Record<ChannelRole, ReadonlySet<AuthzAction>>> = {
  OWNER: new Set<AuthzAction>([
    "channel.update",
    "channel.delete",
    "channel.restore",
    "channel.manage_members",
    "channel.view_analytics",
    ...CONTENT_EDIT,
    "video.delete",
    ...COMMENT_MODERATION,
    "comment.reply_as_creator",
    "payout.view",
    "payout.manage",
  ]),
  MANAGER: new Set<AuthzAction>([
    "channel.update",
    "channel.view_analytics",
    ...CONTENT_EDIT,
    "video.delete",
    ...COMMENT_MODERATION,
    "comment.reply_as_creator",
    "payout.view",
  ]),
  EDITOR: new Set<AuthzAction>(["channel.view_analytics", ...CONTENT_EDIT]),
  MODERATOR: new Set<AuthzAction>([...COMMENT_MODERATION, "video.preview"]),
  TRANSLATOR: new Set<AuthzAction>(["video.preview", "video.subtitles", "video.translate"]),
};

/** Actions a channel under `LIMITED` status loses (the platform restricted uploads and selling). */
export const LIMITED_DENIED: ReadonlySet<AuthzAction> = new Set<AuthzAction>([
  "video.create",
  "video.upload",
  "video.publish",
  "payout.manage",
]);

/** Statuses in which members can no longer change anything (they may still be read by staff). */
export const FROZEN_STATUSES: ReadonlySet<ChannelStatus> = new Set<ChannelStatus>(["SUSPENDED", "BANNED", "DELETED"]);

/**
 * Staff (platform administrators) may not act as the creator in money matters: changing a channel's payout
 * account is the owner's alone. Replying as the creator is a legacy staff capability kept until the channel owner is
 * the author (stage 3); remove it from `LEGACY_STAFF_ALLOWED` then.
 */
export const STAFF_DENIED: ReadonlySet<AuthzAction> = new Set<AuthzAction>(["payout.manage", "channel.manage_members"]);
export const LEGACY_STAFF_ALLOWED: ReadonlySet<AuthzAction> = new Set<AuthzAction>(["comment.reply_as_creator"]);
