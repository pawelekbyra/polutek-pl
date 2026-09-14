import { PublicCreatorPageDTO, PublicVideoDTO } from "@/app/types/video";
import { CreatorContentService } from "@/lib/modules/channel/infrastructure/creator-content.service";
import { VideoContentService } from "@/lib/modules/video/infrastructure/video-content.service";
import { logger } from "@/lib/logger";

export interface HomeContent {
  status: 'loading' | 'ready' | 'error' | 'empty';
  creator: PublicCreatorPageDTO | null;
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
 */
export async function loadHomeContent(): Promise<HomeContent> {
  let creator: PublicCreatorPageDTO | null = null;
  let allVideos: PublicVideoDTO[] = [];
  let mainFeaturedVideo: PublicVideoDTO | null = null;

  try {
    try {
      creator = await CreatorContentService.getConfiguredOrDefaultCreator();
    } catch (err) {
      logger.error("[HOME_CONTENT_LOAD_ERROR] Failed to load creator", err);
    }

    try {
      allVideos = await VideoContentService.getAllVideos();
    } catch (err) {
      logger.error("[HOME_CONTENT_LOAD_ERROR] Failed to load videos", err);
      return {
        status: 'empty',
        creator,
        mainVideo: null,
        allVideos: [],
        publicMessage: "Brak dostępnych materiałów."
      };
    }

    try {
      mainFeaturedVideo = (await VideoContentService.getMainFeaturedVideo())
        || (allVideos.length > 0 ? allVideos[0] : null);
    } catch (err) {
      logger.error("[HOME_CONTENT_LOAD_ERROR] Failed to resolve main video", err);
    }

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

// NOTE: despite the name, this does not actually cache anything — it's a direct
// passthrough to loadHomeContent(). The page(s) calling it are intentionally
// force-dynamic (see KNOWN_LIMITATIONS.md's scalability note), so there's no
// caching layer here today. Kept as its own function (not just an alias) since it's
// the natural place to add real caching later; don't assume memoization exists
// because of the name.
export async function getHomeContentCached(): Promise<HomeContent> {
  return loadHomeContent();
}
