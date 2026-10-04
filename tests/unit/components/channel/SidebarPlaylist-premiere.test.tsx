/** @vitest-environment jsdom */

import React from "react";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicVideoDTO } from "@/app/types/video";

const mocks = vi.hoisted(() => ({
  auth: {
    isLoaded: true,
    isSignedIn: false,
    userId: null as string | null,
  },
}));

vi.mock("@/lib/auth/react", () => ({
  useAuth: () => mocks.auth,
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock("next/image", () => ({
  default: (props: { alt?: string }) => <div role="img" aria-label={props.alt ?? ""} />,
}));

// Exposes the lock state and the premiere date each tile was given.
vi.mock("@/app/components/AccessLockOverlay", () => ({
  default: ({ state, premiereAt }: { state: string; premiereAt?: string | null }) => (
    <div data-testid="lock-overlay" data-state={state} data-premiere={premiereAt ?? ""} />
  ),
}));

vi.mock("@/app/components/preload/AppPreloadProvider", () => ({
  useAppPreload: () => ({ warmVideo: vi.fn() }),
}));

import { SidebarPlaylist } from "@/app/components/channel/SidebarPlaylist";

const FUTURE = new Date(Date.now() + 3 * 86_400_000).toISOString();

function item(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    slug: id,
    title: `Title ${id}`,
    thumbnailUrl: "",
    tier: "PUBLIC",
    status: "PUBLISHED",
    views: 0,
    publishedAt: null,
    premiereAt: null,
    creatorId: "creator-1",
    isLocked: false,
    ...extra,
  };
}

function layout(viewerState: string) {
  return {
    viewerState,
    sections: [
      { id: "section-free", type: "FREE", title: "Publiczne", items: [item("public-1")] },
      {
        id: "section-upcoming",
        type: "UPCOMING",
        title: "Już wkrótce",
        items: [item("premiere-1", { premiereAt: FUTURE, isLocked: true })],
      },
    ],
  };
}

const baseProps = {
  sortedVideos: [item("public-1") as unknown as PublicVideoDTO],
  t: { views: "views" },
  language: "pl",
  mounted: true,
  onVideoMouseEnter: () => {},
  showSupportBox: false,
};

function upcomingLock() {
  const section = screen.getByTestId("sidebar-upcoming-section");
  return within(section).getByTestId("lock-overlay");
}

describe("SidebarPlaylist upcoming premieres", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders the UPCOMING section under the 'Już wkrótce' header", async () => {
    mocks.auth.isSignedIn = true;
    mocks.auth.userId = "user_1";
    render(<SidebarPlaylist {...baseProps} initialLayout={layout("LOGGED_IN") as never} initialLayoutViewerKey="user_1:in" />);
    await act(async () => {});

    const section = screen.getByTestId("sidebar-upcoming-section");
    expect(within(section).getByText("Już wkrótce")).toBeTruthy();
    expect(within(section).getByText("Title premiere-1")).toBeTruthy();
  });

  it("shows signed-in viewers the premiere tile with that video's own date", async () => {
    mocks.auth.isSignedIn = true;
    mocks.auth.userId = "user_1";
    render(<SidebarPlaylist {...baseProps} initialLayout={layout("LOGGED_IN") as never} initialLayoutViewerKey="user_1:in" />);
    await act(async () => {});

    const lock = upcomingLock();
    expect(lock.getAttribute("data-state")).toBe("COMING_SOON");
    expect(lock.getAttribute("data-premiere")).toBe(FUTURE);
  });

  it("shows guests the sign-in lock on an upcoming premiere", async () => {
    mocks.auth.isSignedIn = false;
    mocks.auth.userId = null;
    render(<SidebarPlaylist {...baseProps} initialLayout={layout("ANONYMOUS") as never} initialLayoutViewerKey="anonymous:out" />);
    await act(async () => {});

    expect(upcomingLock().getAttribute("data-state")).toBe("LOGIN_REQUIRED");
  });

  it("locks an upcoming premiere in the error fallback list too", async () => {
    mocks.auth.isSignedIn = true;
    mocks.auth.userId = "user_1";
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    render(
      <SidebarPlaylist
        {...baseProps}
        sortedVideos={[item("premiere-1", { premiereAt: FUTURE }) as unknown as PublicVideoDTO]}
      />,
    );
    await act(async () => {});

    const lock = screen.getByTestId("lock-overlay");
    expect(lock.getAttribute("data-state")).toBe("COMING_SOON");
  });
});
