/** @vitest-environment jsdom */

import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicVideoDTO } from "@/app/types/video";

const mocks = vi.hoisted(() => ({
  auth: {
    isLoaded: true,
    isSignedIn: false,
    userId: null as string | null,
  },
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("next/image", () => ({
  default: (props: { alt?: string }) => <div role="img" aria-label={props.alt ?? ""} />,
}));

vi.mock("@/app/components/AccessLockOverlay", () => ({
  default: () => <div data-testid="lock-overlay" />,
}));

vi.mock("@/app/components/channel/DonationBox", () => ({
  default: () => <div id="donations">donation-box-stub</div>,
}));

vi.mock("@/app/components/preload/AppPreloadProvider", () => ({
  useAppPreload: () => ({ warmVideo: vi.fn() }),
}));

import { SidebarPlaylist } from "@/app/components/channel/SidebarPlaylist";

const VIDEO: PublicVideoDTO = {
  id: "video-1",
  creatorId: "creator-1",
  title: "Prop fallback title",
  slug: "video-1",
  thumbnailUrl: "",
  tier: "PUBLIC",
  status: "PUBLISHED",
  views: 0,
  likesCount: 0,
  dislikesCount: 0,
} as unknown as PublicVideoDTO;

function layoutPayload(title: string) {
  return {
    viewerState: "ANONYMOUS",
    sections: [
      {
        id: "section-free",
        type: "FREE",
        title: "Publiczne",
        items: [
          {
            id: "video-1",
            slug: "video-1",
            title,
            thumbnailUrl: "",
            tier: "PUBLIC",
            status: "PUBLISHED",
            views: 0,
            publishedAt: null,
            creatorId: "creator-1",
            isLocked: false,
          },
        ],
      },
    ],
  };
}

const baseProps = {
  sortedVideos: [VIDEO],
  selectedVideoId: "video-1",
  viewerIsPatron: false,
  t: { views: "views" },
  language: "pl",
  mounted: true,
  onVideoMouseEnter: () => {},
};

// Mirrors ChannelHome's real markup: the always-mounted mobile "videos" tab panel
// and the desktop aside both render a SidebarPlaylist at the same time.
function TwoMounts() {
  return (
    <>
      <SidebarPlaylist {...baseProps} />
      <SidebarPlaylist {...baseProps} showSupportBox={false} />
    </>
  );
}

describe("SidebarPlaylist shared /api/channel/sidebar request", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mocks.auth.isLoaded = true;
    mocks.auth.isSignedIn = false;
    mocks.auth.userId = null;
    fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => layoutPayload("Layout title"),
    }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("fires ONE request for two simultaneous mounts and renders both", async () => {
    render(<TwoMounts />);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/channel/sidebar");
    // Both instances show their loading skeleton while the shared request is in flight.
    expect(document.querySelectorAll('[aria-busy="true"]').length).toBe(2);

    await act(async () => {});

    // Neither instance is stuck on the skeleton after the shared request resolves.
    expect(document.querySelectorAll('[aria-busy="true"]').length).toBe(0);
    expect(screen.getAllByText("Layout title")).toHaveLength(2);
  });

  it("does not cache results — an auth-state change refetches once for both mounts", async () => {
    const { rerender } = render(<TwoMounts />);
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => layoutPayload("Signed-in title"),
    }));

    mocks.auth.isSignedIn = true;
    mocks.auth.userId = "user_1";
    rerender(<TwoMounts />);

    // Exactly one additional request — not one per mount, and not zero (stale).
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {});
    expect(screen.getAllByText("Signed-in title")).toHaveLength(2);
    expect(screen.queryByText("Layout title")).toBeNull();
  });

  it("falls back to the prop video list for both mounts when the request fails", async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 500, json: async () => ({}) }));

    render(<TwoMounts />);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {});
    expect(document.querySelectorAll('[aria-busy="true"]').length).toBe(0);
    expect(screen.getAllByText("Prop fallback title")).toHaveLength(2);
  });

  it("renders a server-provided layout at once and skips the fetch for the same viewer", async () => {
    const initialLayout = layoutPayload("Server title") as never;
    render(
      <>
        <SidebarPlaylist {...baseProps} initialLayout={initialLayout} initialLayoutViewerKey="anonymous:out" />
        <SidebarPlaylist {...baseProps} showSupportBox={false} initialLayout={initialLayout} initialLayoutViewerKey="anonymous:out" />
      </>,
    );

    // No skeleton pass at all — the list is in the very first render.
    expect(document.querySelectorAll('[aria-busy="true"]').length).toBe(0);
    expect(screen.getAllByText("Server title")).toHaveLength(2);
    await act(async () => {});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refetches when the client viewer differs from the one the server layout was built for", async () => {
    mocks.auth.isSignedIn = true;
    mocks.auth.userId = "user_1";
    render(
      <SidebarPlaylist
        {...baseProps}
        initialLayout={layoutPayload("Server title") as never}
        initialLayoutViewerKey="anonymous:out"
      />,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => {});
    expect(screen.getByText("Layout title")).toBeTruthy();
    expect(screen.queryByText("Server title")).toBeNull();
  });
});
