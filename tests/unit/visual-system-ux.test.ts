import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("shared visual system contracts", () => {
  it("shows the full homepage skeleton only after locale resolution", () => {
    const rootLoading = read("app/loading.tsx");
    const localizedLoading = read("app/[locale]/(home)/loading.tsx");
    const channelHome = read("app/components/ChannelHome.tsx");

    expect(rootLoading).not.toContain("HomePageSkeleton");
    expect(localizedLoading).toContain("HomePageSkeleton");
    expect(channelHome).toContain("CommentsMountPlaceholder");
    expect(channelHome).not.toContain("CommentsShellSkeleton");
  });

  it("keeps public actions tactile and secondary panels proportional", () => {
    const navbar = read("app/components/Navbar.tsx");
    const subscribe = read("app/components/SubscribeButton.tsx");
    const authModal = read("app/components/auth/AuthModal.tsx");
    const comments = read("app/components/comments/components/CommentComposer.tsx");
    const player = read("app/components/VideoPlayer.tsx");

    expect(navbar).toContain("polutek-watch-nav");
    expect(navbar).toContain("var(--chan-blue)");
    expect(subscribe).toContain("border-[var(--cm-");
    expect(authModal).toContain("!max-w-[390px]");
    expect(comments).toContain("bg-[var(--chan-blue-soft)]");
    expect(player).not.toContain("www.polutek.pl");
    expect(player).not.toContain(">P</span>");
  });

  it("keeps the scoped admin shell while preserving the payment settings skin", () => {
    const layout = read("app/admin/layout.tsx");
    const shell = read("app/admin/components/AdminVisualShell.tsx");
    const globals = read("app/globals.css");

    expect(layout).toContain("<AdminVisualShell>{children}</AdminVisualShell>");
    expect(shell).toContain('pathname === "/admin/payments"');
    expect(shell).toContain("admin-visual-shell--payments");
    expect(globals).toContain(".admin-visual-shell [data-slot=\"card\"]");
    expect(globals).toContain(".admin-visual-shell [data-slot=\"button\"]:active");
  });

  it("keeps the channel grid proportional and removes placeholder tabs that did nothing", () => {
    const channel = read("app/[locale]/channel/[slug]/page.tsx");
    const card = read("app/components/ChannelVideoCard.tsx");

    expect(channel).toContain("channel-page-shell");
    expect(channel).toContain("xl:grid-cols-4");
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

  it("gives every color-mix() a static fallback for Safari without color-mix support (all iOS Safari below 16.2, e.g. iPhone 7/8/X)", () => {
    const globals = read("app/globals.css");
    const authModal = read("app/components/auth/AuthModal.tsx");
    const accessLock = read("app/components/AccessLockOverlay.module.css");
    const watchActions = read("app/components/watch-actions.module.css");

    // The fallback layer itself: live color-mix() vars plus a static override
    // for browsers that don't understand color-mix() at all.
    expect(globals).toContain("@supports not (color: color-mix(in srgb, red, red))");
    expect(globals).toMatch(/--cm-[a-z0-9-]+:\s*color-mix\(/);
    expect(globals).toMatch(/--cm-[a-z0-9-]+:\s*rgba?\(/);

    // Public/auth/player surfaces must reference the fallback-safe --cm-*
    // vars, not raw color-mix() (which old Safari silently drops, leaving
    // borders/backgrounds/shadows fully invisible instead of just imprecise).
    expect(authModal).not.toContain("color-mix(");
    expect(accessLock).not.toContain("color-mix(");
    expect(watchActions).not.toContain("color-mix(");
  });
});
