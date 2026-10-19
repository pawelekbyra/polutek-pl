import type { PlaylistVisibilityValue } from "./playlist-rules";

/** A video card inside a public playlist or queue: whitelisted fields only, thumbnail already a public address. */
export interface PlaylistVideoCardDto {
  id: string;
  slug: string;
  title: string;
  titleEn: string | null;
  thumbnailUrl: string;
  duration: string | null;
  tier: "PUBLIC" | "LOGGED_IN";
  isAdult: boolean;
  views: number;
  publishedAt: string | null;
}

export interface PublicPlaylistChannelDto {
  id: string;
  name: string;
  slug: string;
  handle: string | null;
}

export interface PublicPlaylistDto {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  visibility: PlaylistVisibilityValue;
  channel: PublicPlaylistChannelDto;
  items: PlaylistVideoCardDto[];
}

/** One row of a channel's list of public playlists. `itemCount` and the cover count only items the viewer sees. */
export interface PublicPlaylistSummaryDto {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  itemCount: number;
  coverThumbnailUrl: string | null;
  channelSlug: string;
}

/** The watch page's queue: only visible items, in order; `index` is where the open video sits (0-based). */
export interface PlaylistQueueDto {
  slug: string;
  title: string;
  channelSlug: string;
  index: number;
  items: PlaylistVideoCardDto[];
}

export interface StudioPlaylistSummaryDto {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  visibility: PlaylistVisibilityValue;
  itemCount: number;
  updatedAt: string;
}

export interface StudioPlaylistItemDto {
  videoId: string;
  slug: string;
  title: string;
  status: string;
  thumbnailUrl: string;
  position: number;
  /** False when a viewer would not see the item today (draft, unlisted, archived, premiere, removed...). */
  visibleToPublic: boolean;
}

export interface StudioPlaylistDto extends StudioPlaylistSummaryDto {
  channelSlug: string;
  items: StudioPlaylistItemDto[];
}
