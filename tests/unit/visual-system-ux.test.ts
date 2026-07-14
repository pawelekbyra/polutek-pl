import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("shared visual system contracts", () => {
  it("applies the doodle admin shell while preserving the payment settings skin", () => {
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
});
