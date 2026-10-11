/**
 * The channel's public avatar: the single place that decides which picture stands for the channel
 * (home page strip under the player, channel page header, search results, sitemap DTOs).
 *
 * Order: the avatar of the channel owner account (`Creator.user`), then the first administrator's
 * avatar as a fallback for a channel whose owner has no picture. The viewer's own session or profile
 * image is never an input here: the channel looks the same to every visitor, including a logged-in
 * administrator (CLAUDE.md §4.5: the session says who is signed in, nothing about the channel).
 *
 * Pure and dependency-free, so it is safe to import from server code, tests and DTO builders alike.
 */
export interface ChannelAvatarSources {
  /** `Creator.user.imageUrl`: the account that owns the channel. */
  ownerImageUrl?: string | null;
  /** The first administrator's avatar, used only when the owner account has none. */
  adminImageUrl?: string | null;
}

export function resolveChannelAvatarUrl(sources: ChannelAvatarSources): string | null {
  return sources.ownerImageUrl || sources.adminImageUrl || null;
}
