import { cache } from "react";
import type { PublicCreatorHeaderDTO } from "@/app/types/video";
import { CreatorContentService } from "@/lib/modules/channel/infrastructure/creator-content.service";

/**
 * The header of the channel page for `slug` (the channel without its videos, W04), read once per request: the page's
 * `generateMetadata` and the page itself both ask for it, and neither pulls the video catalog. React `cache` is
 * request-scoped, so nothing is shared between viewers or requests. Never throws (null = not found / not visible).
 */
export const getChannelHeaderCached = cache(
  (slug: string): Promise<PublicCreatorHeaderDTO | null> =>
    CreatorContentService.getCreatorHeaderBySlug(slug).catch(() => null),
);
