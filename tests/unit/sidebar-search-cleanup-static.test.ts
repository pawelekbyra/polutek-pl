import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { compareSidebarItems, normalizeSidebarOrder } from "@/lib/modules/video/domain/sidebar-order";

const source = (path: string) => readFileSync(path, "utf8");

describe("#1104 search/sidebar cleanup contracts", () => {
  it("search page uses the dedicated search service and slug-first result links", () => {
    const page = source("app/[locale]/search/page.tsx");
    expect(page).toContain("VideoSearchService.searchPublicVideos");
    expect(page).not.toContain("getSitemapVideos");
    expect(page).toContain("getLocalizedHref(locale, \"watch\", { slug: video.slug || video.id })");
  });

  it("normalizes sidebar order consistently", () => {
    expect(normalizeSidebarOrder(1)).toBe(1);
    expect(normalizeSidebarOrder(2)).toBe(2);
    expect(normalizeSidebarOrder(0)).toBe(Number.MAX_SAFE_INTEGER);
    expect(normalizeSidebarOrder(null)).toBe(Number.MAX_SAFE_INTEGER);
    expect(normalizeSidebarOrder(undefined)).toBe(Number.MAX_SAFE_INTEGER);

    const sorted = [
      { id: "zero", sidebarOrder: 0, publishedAt: "2026-06-03T00:00:00Z" },
      { id: "two", sidebarOrder: 2, publishedAt: "2026-06-01T00:00:00Z" },
      { id: "one", sidebarOrder: 1, publishedAt: "2026-06-01T00:00:00Z" },
      { id: "null", sidebarOrder: null, publishedAt: "2026-06-04T00:00:00Z" },
      { id: "undef", publishedAt: "2026-06-02T00:00:00Z" },
    ].sort(compareSidebarItems);
    expect(sorted.map((item) => item.id)).toEqual(["one", "two", "null", "zero", "undef"]);
  });

  it("backend and fallback import the shared sidebar order helper", () => {
    expect(source("lib/modules/channel/application/channel-layout.service.ts")).toContain("compareSidebarItems");
    expect(source("app/components/ChannelHome.tsx")).toContain("compareSidebarItems");
  });

  it("sidebar exposes top-level creatorId and support box does not send an empty creator id", () => {
    const layout = source("lib/modules/channel/application/channel-layout.service.ts");
    const sidebar = source("app/components/channel/SidebarPlaylist.tsx");
    expect(layout).toContain("creatorId: string");
    expect(layout).toContain("creatorId: v.creatorId");
    expect(sidebar).toContain("find((item) => item.creatorId)");
    expect(sidebar).toContain("if (!supportItem?.creatorId) return null");
    expect(sidebar).not.toContain('creatorId={layout.sections[0]?.items[0]?.creatorId || ""}');
  });

  it("removes dead isPatron prop and tip gate language", () => {
    expect(source("app/components/channel/DonationBox.tsx")).not.toContain("isPatron");
    const sidebar = source("app/components/channel/SidebarPlaylist.tsx");
    expect(sidebar).not.toContain("isPatron=");
    expect(sidebar).not.toContain("TIP GATE");
  });

  it("playlist items use one direct feed link with aria-current and non-blocking lock overlay", () => {
    const sidebar = source("app/components/channel/SidebarPlaylist.tsx");
    expect((sidebar.match(/<Link/g) ?? []).length).toBe(1);
    expect(sidebar).toContain('getLocalizedHref(locale, "home")');
    expect(sidebar).toContain("?v=");
    expect(sidebar).toContain("encodeURIComponent(video.slug || video.id)");
    expect(sidebar).toContain('aria-current={isCurrent ? "page" : undefined}');
    expect(sidebar).toContain('className="pointer-events-none"');
    expect(sidebar).toContain("onMouseEnter={() => {");
    expect(sidebar).toContain("onVideoMouseEnter(video.id);");
    expect(sidebar).toContain("void preloader?.warmVideo(video.id");
  });
});
