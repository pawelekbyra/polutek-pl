import { VideoContentService } from "../infrastructure/video-content.service";

/**
 * The description of one video the public may open by link, or null (hidden, removed, not yet due, unknown). The home
 * list carries no descriptions (W03); the open video's one is read here. Public read: visibility is decided in
 * VideoContentService.getPublicVideoDetail, the same rule as the public video page.
 */
export function getPublicVideoDescription(idOrSlug: string) {
  return VideoContentService.getPublicVideoDetail(idOrSlug);
}
