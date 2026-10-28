/** @vitest-environment jsdom */

import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicVideoDTO } from "@/app/types/video";

const mocks = vi.hoisted(() => ({
  auth: { isLoaded: true, isSignedIn: false, userId: null as string | null },
}));

vi.mock("@/lib/auth/react", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock("next/image", () => ({
  default: (props: { alt?: string }) => <div role="img" aria-label={props.alt ?? ""} />,
}));
vi.mock("@/app/components/AccessLockOverlay", () => ({ default: () => <div /> }));
vi.mock("@/app/components/preload/AppPreloadProvider", () => ({
  useAppPreload: () => ({ warmVideo: vi.fn(), releaseVideoIntent: vi.fn() }),
}));

import { SidebarPlaylist } from "@/app/components/channel/SidebarPlaylist";
import { sidebarLayoutViewerKey, type SidebarLayout } from "@/app/components/channel/sidebar-layout-request";

function item(n: number) {
  return {
    id: `video-${n}`,
    slug: `video-${n}`,
    title: `Film ${n}`,
    thumbnailUrl: "",
    tier: "PUBLIC",
    status: "PUBLISHED",
    views: 0,
    publishedAt: null,
    creatorId: "creator-1",
    isLocked: false,
  };
}

function layout(from: number, to: number, total?: number): SidebarLayout {
  return {
    viewerState: "ANONYMOUS",
    sections: [
      {
        id: "section-free",
        type: "FREE",
        title: "Publiczne",
        items: Array.from({ length: to - from + 1 }, (_, i) => item(from + i)) as never,
        ...(total === undefined ? {} : { total }),
      },
    ],
  };
}

const baseProps = {
  sortedVideos: [] as PublicVideoDTO[],
  selectedVideoId: "video-1",
  t: { views: "views" },
  language: "pl" as const,
  initialLayoutViewerKey: sidebarLayoutViewerKey(null, false),
};

function titles() {
  return screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent);
}

describe("SidebarPlaylist: Show more (W03)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mocks.auth.isLoaded = true;
    mocks.auth.isSignedIn = false;
    mocks.auth.userId = null;
    fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => layout(3, 4, 4) }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("shows no button when the whole section is on screen", () => {
    render(<SidebarPlaylist {...baseProps} initialLayout={layout(1, 2, 2)} />);
    expect(screen.queryByTestId("sidebar-more-FREE")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows no button for a layout without totals (older payloads)", () => {
    render(<SidebarPlaylist {...baseProps} initialLayout={layout(1, 2)} />);
    expect(screen.queryByTestId("sidebar-more-FREE")).toBeNull();
  });

  it("asks for the next page after the items on screen and appends it in order", async () => {
    render(<SidebarPlaylist {...baseProps} initialLayout={layout(1, 2, 4)} />);
    expect(titles()).toEqual(["Film 1", "Film 2"]);

    await act(async () => {
      fireEvent.click(screen.getByTestId("sidebar-more-FREE"));
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/channel/sidebar?section=FREE&offset=2", { cache: "no-store" });
    expect(titles()).toEqual(["Film 1", "Film 2", "Film 3", "Film 4"]);
    // Everything is on screen now: the button is gone.
    expect(screen.queryByTestId("sidebar-more-FREE")).toBeNull();
  });

  it("keeps the list and the button when the request fails", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    render(<SidebarPlaylist {...baseProps} initialLayout={layout(1, 2, 4)} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("sidebar-more-FREE"));
    });

    expect(titles()).toHaveLength(2);
    expect(screen.getByTestId("sidebar-more-FREE")).toBeTruthy();
  });
});
