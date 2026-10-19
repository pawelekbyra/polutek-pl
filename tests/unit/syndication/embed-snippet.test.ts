import { describe, expect, it } from "vitest";
import {
  buildEmbedSnippet,
  buildEmbedUrl,
  computeEmbedSize,
  EMBED_DEFAULT_WIDTH,
  EMBED_MAX_WIDTH,
  escapeHtmlAttribute,
  parseEmbedDimension,
} from "@/lib/embed/embed-snippet";
import { buildChannelFeedPath, buildEmbedPath, isChannelFeedPath, isEmbedPath } from "@/lib/embed/paths";

describe("embed paths", () => {
  it("recognizes exactly /embed/<slug> as the framable page", () => {
    expect(isEmbedPath("/embed/moj-film")).toBe(true);
    expect(isEmbedPath("/embed/moj-film/")).toBe(true);
    for (const path of ["/embed", "/embed/", "/embed/a/b", "/pl/embed/a", "/embedded/a", "/", "/en", "/api/oembed", "/channel/x/feed.xml"]) {
      expect(isEmbedPath(path)).toBe(false);
    }
  });

  it("recognizes /channel/<slug>/feed.xml as the feed", () => {
    expect(isChannelFeedPath("/channel/perfect/feed.xml")).toBe(true);
    for (const path of ["/channel/perfect", "/channel/perfect/feed", "/en/channel/perfect/feed.xml", "/channel/a/b/feed.xml"]) {
      expect(isChannelFeedPath(path)).toBe(false);
    }
  });

  it("builds encoded paths", () => {
    expect(buildEmbedPath("a b")).toBe("/embed/a%20b");
    expect(buildEmbedPath("x", "en")).toBe("/embed/x?lang=en");
    expect(buildChannelFeedPath("kanał")).toBe("/channel/kana%C5%82/feed.xml");
  });
});

describe("computeEmbedSize", () => {
  it("defaults to 640x360 (16:9)", () => {
    expect(computeEmbedSize()).toEqual({ width: EMBED_DEFAULT_WIDTH, height: 360 });
  });

  it("honours maxwidth and maxheight, never exceeding either", () => {
    expect(computeEmbedSize({ maxWidth: 320 })).toEqual({ width: 320, height: 180 });
    expect(computeEmbedSize({ maxHeight: 180 })).toEqual({ width: 320, height: 180 });
    expect(computeEmbedSize({ maxWidth: 1000, maxHeight: 300 })).toEqual({ width: 533, height: 300 });
    for (const [w, h] of [[301, 99], [1, 1], [777, 555], [5, 500]] as const) {
      const size = computeEmbedSize({ maxWidth: w, maxHeight: h });
      expect(size.width).toBeLessThanOrEqual(Math.max(w, 1));
      expect(size.height).toBeLessThanOrEqual(Math.max(h, 1));
      expect(size.width).toBeGreaterThanOrEqual(1);
      expect(size.height).toBeGreaterThanOrEqual(1);
    }
  });

  it("caps a huge maxwidth", () => {
    expect(computeEmbedSize({ maxWidth: 99999 }).width).toBe(EMBED_MAX_WIDTH);
  });

  it("ignores missing or non-positive limits", () => {
    expect(computeEmbedSize({ maxWidth: null, maxHeight: undefined })).toEqual({ width: 640, height: 360 });
    expect(computeEmbedSize({ maxWidth: 0, maxHeight: -5 })).toEqual({ width: 640, height: 360 });
  });
});

describe("parseEmbedDimension", () => {
  it("accepts positive whole numbers only", () => {
    expect(parseEmbedDimension("480")).toBe(480);
    expect(parseEmbedDimension(480)).toBe(480);
    for (const bad of ["", "0", "-3", "12.5", "1e3", "abc", "9999999", null, undefined, 0, 2.5]) {
      expect(parseEmbedDimension(bad as string | number | null | undefined)).toBeNull();
    }
  });
});

describe("buildEmbedSnippet", () => {
  it("builds the iframe for the embed page on the given origin", () => {
    const html = buildEmbedSnippet({ baseUrl: "https://www.pawelperfect.com/", slug: "moj-film", title: "Mój film", lang: "en" });
    expect(html).toBe(
      '<iframe src="https://www.pawelperfect.com/embed/moj-film?lang=en" width="640" height="360" title="Mój film" ' +
        'frameborder="0" allow="fullscreen; picture-in-picture" allowfullscreen loading="lazy" ' +
        'referrerpolicy="strict-origin-when-cross-origin"></iframe>',
    );
  });

  it("uses the given size and omits lang when not asked for", () => {
    const html = buildEmbedSnippet({ baseUrl: "https://x.test", slug: "s", title: "t", width: 800, height: 450 });
    expect(html).toContain('src="https://x.test/embed/s"');
    expect(html).toContain('width="800" height="450"');
  });

  it("derives the height from a lone width", () => {
    expect(buildEmbedSnippet({ baseUrl: "https://x.test", slug: "s", title: "t", width: 320 })).toContain('width="320" height="180"');
  });

  it("escapes the title and the slug so nothing can break out of the attribute", () => {
    const html = buildEmbedSnippet({ baseUrl: "https://x.test", slug: 'a"><script>alert(1)</script>', title: `Tytuł "cudzysłów" & <b>'x'</b>` });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('"><script');
    expect(html).toContain('title="Tytuł &quot;cudzysłów&quot; &amp; &lt;b&gt;&#39;x&#39;&lt;/b&gt;"');
    expect(html.match(/<iframe/g)).toHaveLength(1);
  });

  it("escapeHtmlAttribute and buildEmbedUrl", () => {
    expect(escapeHtmlAttribute(`&"'<>`)).toBe("&amp;&quot;&#39;&lt;&gt;");
    expect(buildEmbedUrl("https://x.test///", "a b", "pl")).toBe("https://x.test/embed/a%20b?lang=pl");
  });
});
