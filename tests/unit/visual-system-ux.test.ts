import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("shared visual system contracts", () => {
  it("shows the full homepage preloader only after locale resolution", () => {
    const rootLoading = read("app/loading.tsx");
    const localizedLoading = read("app/[locale]/(home)/loading.tsx");
    const channelHome = read("app/components/ChannelHome.tsx");

    expect(rootLoading).not.toContain("HomePageSkeleton");
    expect(rootLoading).not.toContain("SitePreloaderScreen");
    expect(localizedLoading).toContain("HomeRouteLoading");
    // Comments are server-rendered with their first page: no mount placeholder skeleton.
    expect(channelHome).not.toContain("CommentsMountPlaceholder");
    expect(channelHome).not.toContain("CommentsShellSkeleton");
  });

  it("keeps public actions tactile and secondary panels proportional", () => {
    const navbar = read("app/components/Navbar.tsx");
    const subscribe = read("app/components/SubscribeButton.tsx");
    const authModal = read("app/components/auth/AuthModal.tsx");
    const comments = read("app/components/comments/components/CommentComposer.tsx");
    const player = read("app/components/VideoPlayer.tsx");

    expect(navbar).toContain("polutek-watch-nav");
    expect(read("app/components/LanguageSwitcher.tsx")).toContain("var(--chan-blue)");
    expect(navbar).toContain("LanguageSwitcher");
    expect(subscribe).toContain("border-[var(--cm-");
    expect(authModal).toContain("!max-w-[390px]");
    expect(comments).toContain("bg-[var(--chan-blue-soft)]");
    expect(player).not.toContain("www.polutek.pl");
    expect(player).not.toContain(">P</span>");
  });

  it("keeps the channel grid proportional and removes placeholder tabs that did nothing", () => {
    const channel = read("app/[locale]/channel/[slug]/page.tsx");
    const grid = read("app/components/channel/ChannelVideoGrid.tsx");
    const card = read("app/components/ChannelVideoCard.tsx");

    expect(channel).toContain("channel-page-shell");
    // The grid lives in ChannelVideoGrid (first page from the server, "Show more" appends).
    expect(grid).toContain("xl:grid-cols-4");
    expect(channel).not.toContain('"Playlisty"');
    expect(channel).not.toContain('"Społeczność"');
    expect(card).toContain("channel-video-card-media");
    expect(card).not.toContain('name="more-vertical"');
  });

  it("uses one reduced-motion-aware shimmer language for public, channel, and admin skeletons", () => {
    const skeleton = read("components/ui/skeleton.tsx");
    const globals = read("app/globals.css");

    expect(skeleton).toContain("app-skeleton");
    expect(globals).toContain("polutek-skeleton-sweep");
    expect(globals).toContain("prefers-reduced-motion: reduce");
    expect(globals).toContain(".public-visual-shell .app-skeleton::after");
    expect(globals).toContain(".channel-page-shell .app-skeleton::after");
  });

  it("keeps raw color-mix() out of component CSS: surfaces reference the named --cm-* tints", () => {
    const globals = read("app/globals.css");
    const authModal = read("app/components/auth/AuthModal.tsx");
    const accessLock = read("app/components/AccessLockOverlay.module.css");
    const watchActions = read("app/components/watch-actions.module.css");

    // Tailwind 4 already needs color-mix() (see "browserslist" in package.json), so there is no
    // static fallback layer; the tints are defined once in globals.css and referenced by name.
    expect(globals).not.toContain("@supports not (color: color-mix");
    expect(globals).toMatch(/--cm-[a-z0-9-]+:\s*color-mix\(/);
    expect(authModal).not.toContain("color-mix(");
    expect(accessLock).not.toContain("color-mix(");
    expect(watchActions).not.toContain("color-mix(");
  });

});
