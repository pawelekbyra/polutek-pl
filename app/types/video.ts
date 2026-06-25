import { AccessTier, VideoStatus } from "@prisma/client";

export interface Creator {
  id: string;
  name: string;
  slug: string;
  email?: string | null;
  bio?: string | null;
  imageUrl?: string | null;
  bannerUrl?: string | null;
  subscribersCount: number;
}

/**
 * Internal/admin-only video shape.
 * Do not use this type in public frontend components.
 * Public UI must use PublicVideoDTO.
 */
export interface InternalVideoDTO {
  id: string;
  creatorId: string;
  title: string;
  titleEn?: string | null;
  slug: string;
  description?: string | null;
  descriptionEn?: string | null;
  videoUrl: string;
  thumbnailUrl: string;
  duration?: string | null;
  tier: AccessTier;
  status: VideoStatus;
  views: number;
  likesCount: number;
  dislikesCount: number;
  isMainFeatured: boolean;
  sidebarOrder?: number;
  publishedAt?: Date | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  creator?: Creator;
}

export type VideoTextTrackDTO = {
  src: string;
  label: string;
  language: string;
  kind: 'subtitles' | 'captions';
  default?: boolean;
};

export interface PublicCreatorDTO {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string | null;
  subscribersCount: number;
}

export type PublicCreatorPageDTO = PublicCreatorDTO & {
  bio?: string | null;
  bannerUrl?: string | null;
  userId?: string;
  videos: PublicVideoDTO[];
};

export interface PublicVideoDTO {
  id: string;
  creatorId: string;
  title: string;
  titleEn?: string | null;
  slug: string;
  description?: string | null;
  descriptionEn?: string | null;
  thumbnailUrl: string;
  duration?: string | null;
  tier: AccessTier;
  status: VideoStatus;
  views: number;
  likesCount: number;
  dislikesCount: number;
  isMainFeatured: boolean;
  sidebarOrder?: number;
  publishedAt?: Date | string | null;
  creator?: PublicCreatorDTO;
  textTracks?: VideoTextTrackDTO[];
  // Ensure no raw fields are present
  videoUrl?: never;
  sourceUrl?: never;
  rawUrl?: never;
}

export type VideoTextTrackDTO = {
  src?: string | null;
  kind?: string | null;
  label?: string | null;
  language?: string | null;
  srcLang?: string | null;
  default?: boolean | null;
};

const CAPTION_TRACK_KINDS = new Set(["subtitles", "captions"]);

export function isTrackCaptionKind(
  kind: string | null | undefined,
): kind is "subtitles" | "captions" {
  return CAPTION_TRACK_KINDS.has(String(kind || "").toLowerCase());
}

export function normalizeTextTracks(tracks: unknown): VideoTextTrackDTO[] {
  if (!Array.isArray(tracks)) return [];

  return tracks
    .map((track): VideoTextTrackDTO | null => {
      if (!track || typeof track !== "object") return null;
      const candidate = track as Record<string, unknown>;
      const src = typeof candidate.src === "string" ? candidate.src.trim() : "";
      if (!src) return null;

      const kind =
        typeof candidate.kind === "string"
          ? candidate.kind.toLowerCase()
          : "subtitles";
      if (!isTrackCaptionKind(kind)) return null;

      const srcLangValue = candidate.srcLang ?? candidate.language;
      const srcLang =
        typeof srcLangValue === "string" && srcLangValue.trim()
          ? srcLangValue.trim()
          : "pl";

      return {
        src,
        kind,
        label:
          typeof candidate.label === "string" && candidate.label.trim()
            ? candidate.label.trim()
            : srcLang.toUpperCase(),
        srcLang,
        default: Boolean(candidate.default),
      };
    })
    .filter((track): track is VideoTextTrackDTO => Boolean(track));
}

export interface PlaybackDTO {
  playbackUrl: string;
  expiresAt?: string;
  contentType?: string;
}
