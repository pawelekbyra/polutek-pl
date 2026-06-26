import type { PublicVideoDTO } from "@/app/types/video";
import { VideoSearchService } from "@/lib/services/content/video-search.service";

export const normalizePublicVideoSearchQuery = VideoSearchService.normalizeQuery;

export function searchPublicVideos(
  videos: PublicVideoDTO[],
  query: string | null | undefined,
): PublicVideoDTO[] {
  const normalizedQuery = VideoSearchService.normalizeQuery(query);
  if (!normalizedQuery) return [];
  return VideoSearchService.rankVideos(videos, normalizedQuery);
}
