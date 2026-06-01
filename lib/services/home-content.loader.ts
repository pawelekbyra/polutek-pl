import { ContentService } from "./content.service";
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
      creator = await ContentService.getCreatorBySlug("polutek");
      debug.creatorSuccess = true;
    } catch (e) {
      console.error("[HOME_CONTENT_LOAD_ERROR] Failed to load creator", getSafeErrorInfo(e));
      // Creator failure might not be fatal if we still have videos, but usually it is for polutek
    }

    // 2. Load All Videos
    debug.stage = "loading_all_videos";
    try {
      allVideos = (await ContentService.getAllVideos()) || [];
      debug.allVideosSuccess = true;
      debug.allVideosCount = allVideos.length;
    } catch (e) {
      console.error("[HOME_CONTENT_LOAD_ERROR] Failed to load all videos", getSafeErrorInfo(e));
      throw e; // Fatal for home content
    }

    // 3. Load Main Video
    debug.stage = "loading_main_video";
    try {
      mainVideo = await ContentService.getMainFeaturedVideo();
      debug.mainVideoSuccess = true;
      debug.mainVideoId = mainVideo?.id || null;
    } catch (e) {
      console.error("[HOME_CONTENT_LOAD_ERROR] Failed to load main video", getSafeErrorInfo(e));
      // Not necessarily fatal if allVideos worked, but we'll log it
    }

    if (process.env.DEBUG_HOME_CONTENT === "true") {
      console.log("[HOME_CONTENT_DEBUG] Loader finished", {
        status: allVideos.length > 0 ? "ready" : "empty",
        ...debug,
      });
    }

    if (allVideos.length === 0 && !mainVideo) {
      return { status: "empty", creator, allVideos: [], mainVideo: null, debug };
    }

    return { status: "ready", creator, allVideos, mainVideo, debug };
  } catch (error) {
    const safeInfo = getSafeErrorInfo(error);
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
