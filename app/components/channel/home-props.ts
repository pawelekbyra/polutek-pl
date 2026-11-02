import type { PublicVideoDTO } from "@/app/types/video";
import type { SidebarLayout } from "./sidebar-layout-request";
import type { InitialPlaybackPlan } from "../preload/initial-playback-plan";
import type { InitialCommentsPage } from "../comments/initial-comments";
import type { ContinueWatchingItem } from "@/lib/modules/watch-progress/domain/continue-watching";
import type { PlaylistQueueDto } from "@/lib/modules/playlists/domain/playlist.dto";

export interface ChannelHomeProps {
  mainVideo: PublicVideoDTO | null;
  allVideos: PublicVideoDTO[];
  /**
   * The selected video when `?v=` points outside `allVideos` (another channel or not in the sidebar), already
   * checked for public visibility by the server. It is playable and selectable but is not added to the sidebar.
   */
  extraVideo?: PublicVideoDTO | null;
  currentVideoId?: string;
  userProfile?: {
    id: string;
    email: string;
    imageUrl?: string | null;
    totalPaid: number;
    initialInteraction?: { liked: boolean; disliked: boolean; favorited?: boolean };
    initialIsSubscribed?: boolean;
    initialNotify?: boolean;
    /** The viewer's saved position in the server-selected video (resume watching). */
    initialProgressSeconds?: number | null;
    role?: string;
  } | null;
  /** The signed-in viewer's unfinished videos ("Continue watching"), computed on the server. */
  continueWatching?: ContinueWatchingItem[] | null;
  /** Server-rendered sidebar layout, so the playlist is in the first HTML (see HomeExperience). */
  initialSidebarLayout?: SidebarLayout | null;
  /** Viewer the server-rendered layout was built for (`sidebarLayoutViewerKey`). */
  initialSidebarViewerKey?: string;
  /** The playlist the page was opened in (`?list=<slug>`), already filtered for this viewer (docs/architecture/playlists.md). */
  playlistQueue?: PlaylistQueueDto | null;
  /** First page of the selected video's comments, rendered on the server. */
  initialComments?: InitialCommentsPage | null;
  /** The selected video's playback plan, made on the server for this viewer. */
  initialPlayback?: InitialPlaybackPlan | null;
  /** Server render time (ISO): the clock for relative dates in the first render. */
  renderedAt?: string;
}
