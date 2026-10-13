import { cache } from "react";
import { PublicVideoDTO } from "@/app/types/video";
import {
  CreatorContentService,
  type HomeCreatorSummary,
} from "@/lib/modules/channel/infrastructure/creator-content.service";
import { VideoContentService } from "@/lib/modules/video/infrastructure/video-content.service";
import { logger } from "@/lib/logger";
import { needsExtraVideoLookup, pickHomeVideo } from "@/lib/home-video-selection";

export interface HomeContent {
  status: 'loading' | 'ready' | 'error' | 'empty';
  creator: HomeCreatorSummary | null;
  mainVideo: PublicVideoDTO | null;
  allVideos: PublicVideoDTO[];
  error?: string;
  publicMessage?: string;
  debug?: {
    stage: string;
    creatorSuccess: boolean;
    allVideosSuccess: boolean;
    mainVideoId: string | null;
    allVideosCount: number;
  };
}

/**
 * Core business logic for loading the initial homepage state.
 * This is decoupled from React components for easier testing.
 *
 * The channel summary, the video list and the featured video are independent reads, so they run
 * in parallel; the main-channel row and the admin avatar they all need are read once per render
 * (React `cache` in MainChannelService / VideoContentService).
 */
export async function loadHomeContent(): Promise<HomeContent> {
  try {
    const [creatorResult, videosResult, featuredResult] = await Promise.allSettled([
      CreatorContentService.getConfiguredCreatorSummary(),
      VideoContentService.getAllVideos(),
      VideoContentService.getMainFeaturedVideo(),
    ]);

    let creator: HomeCreatorSummary | null = null;
    if (creatorResult.status === 'fulfilled') {
      creator = creatorResult.value;
    } else {
      logger.error("[HOME_CONTENT_LOAD_ERROR] Failed to load creator", creatorResult.reason);
    }

    if (videosResult.status === 'rejected') {
      logger.error("[HOME_CONTENT_LOAD_ERROR] Failed to load videos", videosResult.reason);
      return {
        status: 'empty',
        creator,
        mainVideo: null,
        allVideos: [],
        publicMessage: "Brak dostępnych materiałów."
      };
    }
    const allVideos = videosResult.value;

    let featured: PublicVideoDTO | null = null;
    if (featuredResult.status === 'fulfilled') {
      featured = featuredResult.value;
    } else {
      logger.error("[HOME_CONTENT_LOAD_ERROR] Failed to resolve main video", featuredResult.reason);
    }
    const mainFeaturedVideo = featured || (allVideos.length > 0 ? allVideos[0] : null);

    if (!mainFeaturedVideo && allVideos.length === 0) {
        return {
            status: 'empty',
            creator,
            mainVideo: null,
            allVideos: [],
            publicMessage: "Brak dostępnych materiałów."
        };
    }

    return {
      status: 'ready',
      creator,
      mainVideo: mainFeaturedVideo,
      allVideos,
    };
  } catch (globalErr) {
    logger.error("[HOME_CONTENT_LOAD_ERROR] Global failure", globalErr);
    return {
      status: 'error',
      creator: null,
      mainVideo: null,
      allVideos: [],
      error: "GLOBAL_FAILURE",
    };
  }
}

/**
 * The home content of the current request. `generateMetadata`, the page and HomeExperience all
 * call this; React `cache` makes it one load per request (it is request-scoped, so nothing is
 * shared between viewers or requests: the page stays per-request, as the premiere and tier
 * logic need).
 */
export const getHomeContentCached = cache(loadHomeContent);

export interface HomeSelection {
  /** The video the page plays for `?v=` (list video, extra video or hero), or null when there is nothing to play. */
  selectedVideo: PublicVideoDTO | null;
  /** Set only when `?v=` points outside the home list and the video passed the public visibility rules. */
  extraVideo: PublicVideoDTO | null;
}

/**
 * The selection of the current request, shared by the page, its metadata and HomeExperience (React `cache`, keyed by
 * the `?v=` value). A link to a video that is not in the home list (another channel, or not in the sidebar) is
 * loaded here by id or slug with the public visibility rules; a hidden or unknown one falls back to the hero.
 */
export const getHomeSelectionCached = cache(async (videoId: string | undefined): Promise<HomeSelection> => {
  const content = await getHomeContentCached();
  if (content.status === 'error' || content.status === 'empty') return { selectedVideo: null, extraVideo: null };
  let extraVideo: PublicVideoDTO | null = null;
  if (videoId && needsExtraVideoLookup(videoId, content.allVideos)) {
    extraVideo = await VideoContentService.getPublicVideoByIdOrSlug(videoId);
  }
  return {
    selectedVideo: pickHomeVideo(videoId, { allVideos: content.allVideos, mainVideo: content.mainVideo, extraVideo }),
    extraVideo,
  };
});
