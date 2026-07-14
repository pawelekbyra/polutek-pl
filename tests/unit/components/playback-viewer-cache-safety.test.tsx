/** @vitest-environment jsdom */

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicVideoDTO } from "@/app/types/video";
import type { PlaybackPlan } from "@/lib/modules/playback";

const mocks = vi.hoisted(() => ({
  auth: {
    isLoaded: false,
    userId: null as string | null,
    sessionId: null as string | null,
  },
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@/app/components/PlayerLoadingState", () => ({
  PlayerLoadingState: () => <div data-testid="player-loading" />,
}));

vi.mock("@/app/components/PlayerStateFrame", () => ({
  PlayerStateFrame: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/app/components/AccessLockOverlay", () => ({
  default: ({ state }: { state: string }) => <div data-testid="player-locked">{state}</div>,
}));

import PremiumWrapper, {
  isPlayablePlaybackPlan,
} from "@/app/components/PremiumWrapper";
import { AppPreloadProvider } from "@/app/components/preload/AppPreloadProvider";

type FetchDeferred = {
  resolve: (response: Response) => void;
};

const TEST_VIDEO: PublicVideoDTO = {
  id: "video-1",
  creatorId: "creator-1",
  title: "Video",
  slug: "video",
  thumbnailUrl: "",
  tier: "PATRON",
  status: "PUBLISHED",
  views: 0,
  likesCount: 0,
  dislikesCount: 0,
  isMainFeatured: true,
};

function createReadyPlan(videoId = "video-1"): PlaybackPlan {
  return {
    videoId,
    status: "READY",
    canPlay: true,
    access: { allowed: true },
    source: {
      provider: "CLOUDFLARE_STREAM",
      kind: "cloudflare_stream",
      playbackUrl: "/api/media/video-1",
      needsProxy: true,
      isExternalEmbed: false,
      isSignedUrl: false,
    },
    player: {
      autoplayAllowed: false,
      mutedAutoplay: false,
      controls: true,
      poster: "",
      title: "Video",
    },
    diagnostics: {
      warnings: [],
      sourceConfidence: "HIGH",
      providerResolutionAllowed: true,
      providerResolutionAttempted: true,
    },
    tracking: {
      playbackSessionId: "playback-session",
      heartbeatIntervalSeconds: 15,
    },
  };
}

function createDeniedPlan(videoId = "video-1"): PlaybackPlan {
  return {
    ...createReadyPlan(videoId),
    status: "PATRON_REQUIRED",
    canPlay: false,
    access: {
      allowed: false,
      reason: "PATRON_REQUIRED",
      requiredTier: "PATRON",
    },
    source: undefined,
    tracking: {
      playbackSessionId: "",
      heartbeatIntervalSeconds: 0,
    },
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response;
}

function TestTree({
  queryClient,
  selectedVideo = null,
}: {
  queryClient: QueryClient;
  selectedVideo?: PublicVideoDTO | null;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <AppPreloadProvider
        selectedVideo={selectedVideo}
        allVideos={selectedVideo ? [selectedVideo] : []}
      >
        <PremiumWrapper videoId="video-1" requiredTier="PATRON">
          <div data-testid="mounted-player">player</div>
        </PremiumWrapper>
      </AppPreloadProvider>
    </QueryClientProvider>
  );
}

describe("playback viewer cache safety", () => {
  let deferredRequests: FetchDeferred[];
  let queryClient: QueryClient;

  beforeEach(() => {
    deferredRequests = [];
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mocks.auth.isLoaded = false;
    mocks.auth.userId = null;
    mocks.auth.sessionId = null;
    global.fetch = vi.fn(() => new Promise<Response>((resolve) => {
      deferredRequests.push({ resolve });
    }));
  });

  afterEach(() => {
    cleanup();
    queryClient.clear();
    vi.restoreAllMocks();
  });

  it("does not preload playback before Clerk resolves the current viewer", async () => {
    const view = render(<TestTree queryClient={queryClient} selectedVideo={TEST_VIDEO} />);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.queryByTestId("mounted-player")).toBeNull();

    mocks.auth.isLoaded = true;
    mocks.auth.userId = "user-a";
    mocks.auth.sessionId = "session-a";
    view.rerender(<TestTree queryClient={queryClient} selectedVideo={TEST_VIDEO} />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  });

  it("drops a READY plan synchronously and fetches again when the session changes", async () => {
    mocks.auth.isLoaded = true;
    mocks.auth.userId = "user-a";
    mocks.auth.sessionId = "session-a";
    const view = render(<TestTree queryClient={queryClient} />);

    await waitFor(() => expect(deferredRequests).toHaveLength(1));
    await act(async () => {
      deferredRequests[0].resolve(jsonResponse(createReadyPlan()));
    });
    expect(await screen.findByTestId("mounted-player")).toBeTruthy();

    mocks.auth.userId = "user-b";
    mocks.auth.sessionId = "session-b";
    view.rerender(<TestTree queryClient={queryClient} />);

    expect(screen.queryByTestId("mounted-player")).toBeNull();
    await waitFor(() => expect(deferredRequests).toHaveLength(2));

    await act(async () => {
      deferredRequests[1].resolve(jsonResponse(createDeniedPlan(), 403));
    });
    expect((await screen.findByTestId("player-locked")).textContent).toContain("PATRON_REQUIRED");
    expect(screen.queryByTestId("mounted-player")).toBeNull();
  });

  it("ignores an old viewer response even when it resolves after the new request", async () => {
    mocks.auth.isLoaded = true;
    mocks.auth.userId = "user-a";
    mocks.auth.sessionId = "session-a";
    const view = render(<TestTree queryClient={queryClient} />);

    await waitFor(() => expect(deferredRequests).toHaveLength(1));

    mocks.auth.userId = "user-b";
    mocks.auth.sessionId = "session-b";
    view.rerender(<TestTree queryClient={queryClient} />);
    await waitFor(() => expect(deferredRequests).toHaveLength(2));
    const firstSignal = (vi.mocked(global.fetch).mock.calls[0][1] as RequestInit).signal;
    expect(firstSignal?.aborted).toBe(true);

    await act(async () => {
      deferredRequests[0].resolve(jsonResponse(createReadyPlan()));
    });
    expect(screen.queryByTestId("mounted-player")).toBeNull();

    await act(async () => {
      deferredRequests[1].resolve(jsonResponse(createDeniedPlan(), 403));
    });
    expect((await screen.findByTestId("player-locked")).textContent).toContain("PATRON_REQUIRED");
    expect(screen.queryByTestId("mounted-player")).toBeNull();
  });

  it("mounts only a canonical READY plan with access, source and the requested video", () => {
    const valid = createReadyPlan();

    expect(isPlayablePlaybackPlan(valid, "video-1")).toBe(true);
    expect(isPlayablePlaybackPlan({ ...valid, status: "PROCESSING" }, "video-1")).toBe(false);
    expect(isPlayablePlaybackPlan({ ...valid, canPlay: false }, "video-1")).toBe(false);
    expect(isPlayablePlaybackPlan({ ...valid, access: { allowed: false } }, "video-1")).toBe(false);
    expect(isPlayablePlaybackPlan({ ...valid, source: undefined }, "video-1")).toBe(false);
    expect(isPlayablePlaybackPlan(valid, "another-video")).toBe(false);
  });
});
