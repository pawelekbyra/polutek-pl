import type { PublicVideoDTO } from "@/app/types/video";
import { prisma } from "@/lib/prisma";
import { AccessTier, VideoStatus } from "@prisma/client";
import { MainChannelService } from "@/lib/channel/main-channel.service";
import { VideoContentService, visiblePublishedAtFilter } from "@/lib/modules/video/infrastructure/video-content.service";

export type VideoSearchMatchedField =
  | "title"
  | "titleEn"
  | "description"
  | "descriptionEn"
  | "slug"
  | "creator";

export type VideoSearchResult = PublicVideoDTO & {
  matchedFields: VideoSearchMatchedField[];
  score: number;
  createdAt?: Date | string | null;
};

type SearchableVideo = PublicVideoDTO & { createdAt?: Date | string | null };

const SEARCHABLE_TIERS = [AccessTier.PUBLIC, AccessTier.LOGGED_IN, AccessTier.PATRON];
const POLISH_DIACRITICS: Record<string, string> = {
  ą: "a",
  ć: "c",
  ę: "e",
  ł: "l",
  ń: "n",
  ó: "o",
  ś: "s",
  ż: "z",
  ź: "z",
};

function scoreText(value: string | null | undefined, query: string, exact: number, starts: number, includes: number): number {
  const normalized = VideoSearchService.normalizeQuery(value);
  if (!normalized) return 0;
  if (exact > 0 && normalized === query) return exact;
  if (starts > 0 && normalized.startsWith(query)) return starts;
  if (normalized.includes(query)) return includes;
  return 0;
}

function timeValue(value: Date | string | null | undefined): number {
  return value ? new Date(value).getTime() : 0;
}

export class VideoSearchService {
  static normalizeQuery(query: string | null | undefined): string {
    return (query ?? "")
      .trim()
      .toLocaleLowerCase("pl-PL")
      .replace(/[ąćęłńóśżź]/g, (char) => POLISH_DIACRITICS[char] ?? char)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  static async searchPublicVideos(query: string, options: { limit?: number } = {}): Promise<VideoSearchResult[]> {
    const normalizedQuery = this.normalizeQuery(query);
    if (!normalizedQuery) return [];

    const mainChannel = await MainChannelService.getOptional();
    const now = new Date();
    const videos = await prisma.video.findMany({
      where: {
        creatorId: mainChannel?.id || "none",
        status: VideoStatus.PUBLISHED,
        tier: { in: SEARCHABLE_TIERS },
        creator: {
          isApproved: true,
          isPrimary: true,
        },
        ...visiblePublishedAtFilter(now),
      },
      include: {
        creator: {
          include: {
            user: {
              select: { imageUrl: true, email: true },
            },
          },
        },
      },
    });

    return this.rankVideos(
      videos.map((video) => ({
        ...VideoContentService.mapToPublicVideoDTO(video),
        createdAt: video.createdAt,
      })),
      normalizedQuery,
      options.limit,
    );
  }

  static rankVideos(videos: SearchableVideo[], normalizedQuery: string, limit = 50): VideoSearchResult[] {
    return videos
      .map((video) => this.scoreVideo(video, normalizedQuery))
      .filter((result): result is VideoSearchResult => Boolean(result))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const publishedDiff = timeValue(b.publishedAt) - timeValue(a.publishedAt);
        if (publishedDiff !== 0) return publishedDiff;
        const createdDiff = timeValue(b.createdAt) - timeValue(a.createdAt);
        if (createdDiff !== 0) return createdDiff;
        return (a.slug || a.id).localeCompare(b.slug || b.id);
      })
      .slice(0, limit);
  }

  private static scoreVideo(video: SearchableVideo, normalizedQuery: string): VideoSearchResult | null {
    const matchedFields: VideoSearchMatchedField[] = [];
    let score = 0;

    const titleScore = scoreText(video.title, normalizedQuery, 1000, 800, 600);
    if (titleScore > 0) matchedFields.push("title");
    score += titleScore;

    const titleEnScore = scoreText(video.titleEn, normalizedQuery, 1000, 800, 600);
    if (titleEnScore > 0) matchedFields.push("titleEn");
    score += titleEnScore;

    const slugScore = scoreText(video.slug, normalizedQuery, 500, 400, 300);
    if (slugScore > 0) matchedFields.push("slug");
    score += slugScore;

    const creatorScore = scoreText(video.creator?.name, normalizedQuery, 0, 0, 250);
    if (creatorScore > 0) matchedFields.push("creator");
    score += creatorScore;

    const descriptionScore = scoreText(video.description, normalizedQuery, 0, 0, 150);
    if (descriptionScore > 0) matchedFields.push("description");
    score += descriptionScore;

    const descriptionEnScore = scoreText(video.descriptionEn, normalizedQuery, 0, 0, 150);
    if (descriptionEnScore > 0) matchedFields.push("descriptionEn");
    score += descriptionEnScore;

    if (score <= 0) return null;
    return { ...video, matchedFields, score };
  }
}

export const normalizePublicVideoSearchQuery = VideoSearchService.normalizeQuery.bind(VideoSearchService);

export function searchPublicVideos(
  videos: PublicVideoDTO[],
  query: string | null | undefined,
): VideoSearchResult[] {
  const normalizedQuery = VideoSearchService.normalizeQuery(query);
  if (!normalizedQuery) return [];
  return VideoSearchService.rankVideos(videos, normalizedQuery);
}
