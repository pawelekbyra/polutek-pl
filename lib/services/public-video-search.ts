import type { PublicVideoDTO } from "@/app/types/video";

export function normalizePublicVideoSearchQuery(
  query: string | null | undefined,
): string {
  return (query ?? "")
    .trim()
    .toLocaleLowerCase("pl-PL")
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
}

function searchableText(video: PublicVideoDTO): string {
  return [
    video.title,
    video.titleEn,
    video.description,
    video.descriptionEn,
    video.slug,
  ]
    .filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    )
    .map(normalizePublicVideoSearchQuery)
    .join(" ");
}

export function searchPublicVideos(
  videos: PublicVideoDTO[],
  query: string | null | undefined,
): PublicVideoDTO[] {
  const normalizedQuery = normalizePublicVideoSearchQuery(query);
  if (!normalizedQuery) return [];

  return videos.filter((video) =>
    searchableText(video).includes(normalizedQuery),
  );
}
