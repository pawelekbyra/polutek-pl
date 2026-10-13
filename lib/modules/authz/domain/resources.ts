/** Role of a user inside one channel. MVP uses only OWNER; the rest exist so the schema and the matrix are ready. */
export const CHANNEL_ROLES = ["OWNER", "MANAGER", "EDITOR", "MODERATOR", "TRANSLATOR"] as const;
export type ChannelRole = (typeof CHANNEL_ROLES)[number];

/** Lifecycle of a channel. Only `ACTIVE` channels are fully usable by their members. */
export const CHANNEL_STATUSES = ["PENDING_REVIEW", "ACTIVE", "LIMITED", "SUSPENDED", "BANNED", "DELETED"] as const;
export type ChannelStatus = (typeof CHANNEL_STATUSES)[number];

/**
 * The facts the policy needs about a channel. `ownerUserId` is `Creator.userId`; `members` comes from
 * `ChannelMember` once that table exists. Both are optional so the policy works before and after the schema stage.
 */
export interface ChannelResource {
  id: string;
  ownerUserId?: string | null;
  members?: readonly { userId: string; role: ChannelRole }[];
  status?: ChannelStatus;
}
