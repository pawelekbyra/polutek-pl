import { ContentService } from "./content.service";
import { flags } from "../feature-flags";
import { PublicVideoDTO, PublicCreatorPageDTO } from "@/app/types/video";

export type HomeContentDebugInfo = {
  creatorSuccess: boolean;
  allVideosSuccess: boolean;
  mainVideoSuccess: boolean;
  allVideosCount: number;
  mainVideoId: string | null;
  stage: string;
};

export type HomeContentLoadResult =
  | {
      status: "ready";
      creator: PublicCreatorPageDTO | null;
      mainVideo: PublicVideoDTO | null;
      allVideos: PublicVideoDTO[];
      debug?: HomeContentDebugInfo;
    }
  | {
      status: "empty";
      creator: PublicCreatorPageDTO | null;
      mainVideo: null;
      allVideos: [];
      debug?: HomeContentDebugInfo;
    }
  | {
      status: "error";
      publicMessage: string;
      debug?: HomeContentDebugInfo;
    };

function getSafeErrorInfo(error: unknown) {
  return {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : "Unknown error",
    prismaCode:
      typeof error === "object" && error && "code" in error
        ? String((error as { code?: unknown }).code)
        : undefined,
  };
}

export async function loadHomeContent(): Promise<HomeContentLoadResult> {
  const debug: HomeContentDebugInfo = {
    creatorSuccess: false,
    allVideosSuccess: false,
    mainVideoSuccess: false,
    allVideosCount: 0,
    mainVideoId: null,
    stage: "init",
  };

  let creator: PublicCreatorPageDTO | null = null;
  let allVideos: PublicVideoDTO[] = [];
  let mainVideo: PublicVideoDTO | null = null;

  try {
    // 1. Load Creator
    debug.stage = "loading_creator";
    try {
      creator = await ContentService.getCreatorBySlug(flags.mainCreatorSlug);
      debug.creatorSuccess = true;
    } catch (e) {
      console.error("[HOME_CONTENT_LOAD_ERROR] Failed to load creator", getSafeErrorInfo(e));
      // Creator failure might not be fatal in multi-creator mode if global videos are still available.
    }

    // 2. Load Videos
    debug.stage = flags.multiCreator ? "loading_all_videos" : "loading_main_creator_videos";
    try {
      allVideos = flags.multiCreator ? (await ContentService.getAllVideos()) || [] : creator?.videos || [];
      debug.allVideosSuccess = true;
      debug.allVideosCount = allVideos.length;
    } catch (e) {
      console.error("[HOME_CONTENT_LOAD_ERROR] Failed to load videos", getSafeErrorInfo(e));
      // If demo fallbacks are enabled, ContentService should already handle it.
      // We re-throw only if it's a critical DB error and no videos were returned.
      if (allVideos.length === 0) {
        throw e;
      }
    }

    // 3. Load Main Video
    debug.stage = "loading_main_video";
    try {
      mainVideo = flags.multiCreator
        ? await ContentService.getMainFeaturedVideo()
        : allVideos.find((video) => video.isMainFeatured) || null;
      debug.mainVideoSuccess = true;
      debug.mainVideoId = mainVideo?.id || null;
    } catch (e) {
      console.error("[HOME_CONTENT_LOAD_ERROR] Failed to load main video", getSafeErrorInfo(e));
      // Not necessarily fatal if allVideos worked
    }

    if (process.env.DEBUG_HOME_CONTENT === "true") {
      console.log("[HOME_CONTENT_DEBUG] Loader finished", {
        status: allVideos.length > 0 ? "ready" : "empty",
        mode: flags.multiCreator ? "multi_creator" : "single_creator",
        mainCreatorSlug: flags.mainCreatorSlug,
        ...debug,
      });
    }

    if (allVideos.length === 0 && !mainVideo) {
      return { status: "empty", creator, allVideos: [], mainVideo: null, debug };
    }

    return { status: "ready", creator, allVideos, mainVideo, debug };
  } catch (error) {
    const safeInfo = getSafeErrorInfo(error);

    // Specific handling for missing columns (P2022) to help with production debugging
    if (safeInfo.prismaCode === "P2022") {
      console.error("[CRITICAL_DB_ERROR] Database schema is out of sync. Missing column. Run 'npx prisma migrate deploy'.", safeInfo);
    }

    console.error("[HOME_CONTENT_LOAD_ERROR] Global failure", {
      stage: debug.stage,
      ...safeInfo,
    });

    return {
      status: "error",
      publicMessage: "Nie udało się wczytać materiałów. Spróbuj odświeżyć stronę później.",
      debug,
    };
  }
}
