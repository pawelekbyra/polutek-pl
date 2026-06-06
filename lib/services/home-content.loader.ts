import { flags } from "../feature-flags";
import { PublicCreatorPageDTO, PublicVideoDTO } from "@/app/types/video";
import { CreatorContentService, VideoContentService } from "./content.service";
import { logger } from "../logger";

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
    // 1. Resolve Creator (Single-creator mode only)
    if (!flags.multiCreator) {
      try {
        creator = await CreatorContentService.getConfiguredOrDefaultCreator();
      } catch (err) {
        logger.error("[HOME_CONTENT_LOAD_ERROR] Failed to load creator", err);
        // We continue because videos might still load or fallbacks might trigger.
      }
    }

    // 2. Load Videos
    try {
      allVideos = flags.multiCreator
        ? (await VideoContentService.getAllVideos()) || []
        : creator?.videos || [];
    } catch (err) {
      logger.error("[HOME_CONTENT_LOAD_ERROR] Failed to load videos", err);
      // In multi-creator mode, failing to load videos is a fatal error for home.
      if (flags.multiCreator) {
          return { status: 'error', creator: null, mainVideo: null, allVideos: [], error: "GLOBAL_FAILURE" };
      }
    }

    // 3. Resolve Main Featured Video
    try {
      // Logic for featured video:
      // a) Explicitly marked as isMainFeatured
      // b) Fallback to the first video in the sorted list
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
