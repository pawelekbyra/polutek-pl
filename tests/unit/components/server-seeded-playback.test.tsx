/** @vitest-environment jsdom */

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicVideoDTO } from "@/app/types/video";
import type { PlaybackPlan } from "@/lib/modules/playback";

const mocks = vi.hoisted(() => ({
  auth: { isLoaded: true, userId: null as string | null, sessionId: null as string | null },
}));

vi.mock("@/lib/auth/react", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/app/components/PlayerLoadingState", () => ({
  PlayerLoadingState: () => <div data-testid="player-loading" />,
}));
vi.mock("@/app/components/PlayerStateFrame", () => ({
  PlayerStateFrame: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/app/components/AccessLockOverlay", () => ({
  default: ({ state }: { state: string }) => <div data-testid="player-locked">{state}</div>,
}));

import PremiumWrapper from "@/app/components/PremiumWrapper";
import { AppPreloadProvider, useAppPreload } from "@/app/components/preload/AppPreloadProvider";

const video = (id: string, tier: PublicVideoDTO["tier"], extra: Partial<PublicVideoDTO> = {}): PublicVideoDTO => ({
  id,
  creatorId: "creator-1",
  title: id,
  slug: id,
  thumbnailUrl: "",
  tier,
  status: "PUBLISHED",
  views: 0,
  likesCount: 0,
  dislikesCount: 0,
  isMainFeatured: false,
  ...extra,
});

const MANIFEST = "https://video.pawelperfect.com/h/1.sig/hero/v1/master.m3u8";

function readyPlan(videoId: string): PlaybackPlan {
  return {
    videoId,
    status: "READY",
    canPlay: true,
    access: { allowed: true },
    source: { provider: "SELF_HLS", kind: "self_hls", playbackUrl: MANIFEST, isSignedUrl: true },
    player: { autoplayAllowed: true, mutedAutoplay: true, controls: true, poster: "", title: videoId },
    diagnostics: {
      warnings: [],
      sourceConfidence: "HIGH",
      providerResolutionAllowed: true,
      providerResolutionAttempted: true,
      sourceMode: "PROVIDER_ASSET",
    },
    tracking: { playbackSessionId: "session-1", heartbeatIntervalSeconds: 15 },
  } as PlaybackPlan;
}

const hero = video("hero", "PUBLIC");
const lockedForGuests = video("members", "LOGGED_IN");
const premiere = video("soon", "PUBLIC", { premiereAt: new Date(Date.now() + 86_400_000).toISOString() });
const other = video("other", "PUBLIC");
const allVideos = [hero, lockedForGuests, premiere, other];

let fetchMock: ReturnType<typeof vi.fn>;

function Probe({ onReady }: { onReady: (api: ReturnType<typeof useAppPreload>) => void }) {
  onReady(useAppPreload());
  return null;
}

function Tree({ children, viewerKey = "anonymous" }: { children?: React.ReactNode; viewerKey?: string }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <AppPreloadProvider
        selectedVideo={hero}
        allVideos={allVideos}
        initialPlayback={{ videoId: "hero", viewerKey, plan: readyPlan("hero") }}
      >
        {children}
      </AppPreloadProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mocks.auth = { isLoaded: true, userId: null, sessionId: null };
  fetchMock = vi.fn(async () => new Response(JSON.stringify(readyPlan("other")), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("requestIdleCallback", () => 0);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("hero playback plan rendered by the server", () => {
  it("mounts the player in the server HTML from the server's plan, with no plan request", () => {
    const html = renderToString(
      <Tree>
        <PremiumWrapper videoId="hero" requiredTier="PUBLIC">
          <div data-testid="player">player</div>
        </PremiumWrapper>
      </Tree>,
    );
    expect(html).toContain('data-testid="player"');
    expect(html).not.toContain("player-loading");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the player mounted after hydration without asking /api/media-source", async () => {
    render(
      <Tree>
        <PremiumWrapper videoId="hero" requiredTier="PUBLIC">
          <div data-testid="player">player</div>
        </PremiumWrapper>
      </Tree>,
    );
    expect(screen.getByTestId("player")).toBeTruthy();
    await act(async () => {});
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/api/media-source/hero"))).toBe(false);
  });

  it("never uses a plan made for another viewer", () => {
    const html = renderToString(
      <Tree viewerKey="user:someone-else:session:s9">
        <PremiumWrapper videoId="hero" requiredTier="PUBLIC">
          <div data-testid="player">player</div>
        </PremiumWrapper>
      </Tree>,
    );
    expect(html).not.toContain('data-testid="player"');
    expect(html).toContain("player-loading");
  });
});

describe("warming other videos", () => {
  async function getApi() {
    let api: ReturnType<typeof useAppPreload> = null;
    render(
      <Tree>
        <Probe onReady={(value) => { api = value; }} />
      </Tree>,
    );
    await act(async () => {});
    fetchMock.mockClear();
    return api!;
  }

  const planRequests = () => fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/media-source/"));

  it("does not open playback sessions in the background", async () => {
    const api = await getApi();
    await act(async () => { await api.warmVideo("other", { priority: "nearby" }); });
    expect(planRequests()).toHaveLength(0);
  });

  it("does not ask for a guest's sign-in-only video or an upcoming premiere", async () => {
    const api = await getApi();
    await act(async () => {
      await api.warmVideo("members", { priority: "intent" });
      await api.warmVideo("soon", { priority: "intent" });
    });
    expect(planRequests()).toHaveLength(0);
  });

  it("on intent warms the plan of a playable video and its manifest", async () => {
    const api = await getApi();
    await act(async () => { await api.warmVideo("other", { priority: "intent" }); });
    expect(planRequests()).toHaveLength(1);
    expect(fetchMock.mock.calls.some(([url]) => url === MANIFEST)).toBe(true);
  });

  it("always fetches when the player itself asks", async () => {
    const api = await getApi();
    await act(async () => { await api.warmVideo("members", { priority: "critical" }); });
    expect(planRequests()).toHaveLength(1);
  });
});
