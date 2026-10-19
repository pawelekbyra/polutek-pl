import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  findVideoForEmbed: vi.fn(),
  rateLimit: vi.fn(),
  headers: new Headers({ "x-forwarded-for": "1.2.3.4" }),
  language: "en",
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: h.rateLimit }));
vi.mock("next/headers", () => ({ headers: async () => h.headers, cookies: async () => ({ get: () => undefined }) }));
vi.mock("@/lib/modules/syndication/infrastructure/syndication.repository", () => ({
  findVideoForEmbed: h.findVideoForEmbed,
  loadChannelFeedSource: vi.fn(),
}));
vi.mock("@/lib/i18n/server-language", () => ({ resolveDocumentLanguage: async () => h.language }));
vi.mock("@/app/embed/[slug]/EmbedPlayer", () => ({ default: function EmbedPlayerStub() { return null; } }));

import EmbedPage from "@/app/embed/[slug]/page";
import EmbedPlayerStub from "@/app/embed/[slug]/EmbedPlayer";
import { getEmbedView } from "@/lib/modules/syndication";

function videoRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "vid-1",
    creatorId: "ch-1",
    slug: "moj-film",
    title: "Mój film",
    titleEn: null,
    description: null,
    descriptionEn: null,
    thumbnailUrl: "private-key",
    thumbnailPublicUrl: null,
    duration: "1:00",
    tier: "PUBLIC",
    status: "PUBLISHED",
    moderationStatus: "VISIBLE",
    isAdult: false,
    views: 0,
    likesCount: 0,
    dislikesCount: 0,
    isMainFeatured: false,
    sidebarOrder: 0,
    publishedAt: new Date("2026-10-01T00:00:00Z"),
    premiereAt: null,
    videoUrl: "must-never-reach-the-client",
    creator: { id: "ch-1", name: "Paweł", slug: "pawel", status: "ACTIVE", deletedAt: null, subscribersCount: 0 },
    ...overrides,
  };
}

async function render(slug = "moj-film") {
  return (await EmbedPage({ params: Promise.resolve({ slug }) })) as { type: unknown; props: Record<string, unknown> };
}

/** Everything the page puts in front of the viewer (the element tree is small enough to stringify). */
function visibleText(node: unknown): string {
  return JSON.stringify(node, (_key, value) => (typeof value === "function" ? undefined : value));
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.pawelperfect.com");
  h.language = "en";
  h.headers = new Headers({ "x-forwarded-for": "1.2.3.4" });
  h.findVideoForEmbed.mockReset().mockResolvedValue(videoRow());
  h.rateLimit.mockReset().mockResolvedValue({ success: true, remaining: 10 });
});

describe("getEmbedView: embed access rules", () => {
  it("lets a PUBLIC published video play, as the whitelisted public DTO (no storage URL)", async () => {
    const view = await getEmbedView("moj-film");
    expect(view.kind).toBe("embeddable");
    if (view.kind === "embeddable") {
      expect(view.video.id).toBe("vid-1");
      expect(view.video.tier).toBe("PUBLIC");
      expect(JSON.stringify(view)).not.toContain("must-never-reach-the-client");
    }
  });

  it.each(["LOGGED_IN", "PAID", "PATRON"])("shows only a card for tier %s", async (tier) => {
    h.findVideoForEmbed.mockResolvedValue(videoRow({ tier }));
    expect(await getEmbedView("moj-film")).toEqual({ kind: "site-only", slug: "moj-film", title: "Mój film" });
  });

  it.each([
    ["missing", null],
    ["UNLISTED", videoRow({ status: "UNLISTED" })],
    ["DRAFT", videoRow({ status: "DRAFT" })],
    ["removed", videoRow({ moderationStatus: "REMOVED" })],
    ["on a hidden channel", videoRow({ creator: { id: "c", name: "x", slug: "x", status: "BANNED", deletedAt: null } })],
  ])("treats a %s video as unavailable", async (_label, row) => {
    h.findVideoForEmbed.mockResolvedValue(row);
    expect(await getEmbedView("moj-film")).toEqual({ kind: "unavailable" });
  });
});

describe("/embed/<slug> page", () => {
  it("mounts the player only for an embeddable video", async () => {
    const tree = await render();
    expect(tree.type).toBe(EmbedPlayerStub);
    expect((tree.props.video as { id: string }).id).toBe("vid-1");
  });

  it("never mounts the player for a signed-in video: a 'watch on the site' card with the explicit-language link", async () => {
    h.findVideoForEmbed.mockResolvedValue(videoRow({ tier: "LOGGED_IN" }));
    const tree = await render();
    expect(tree.type).not.toBe(EmbedPlayerStub);
    const text = visibleText(tree);
    expect(text).toContain("Mój film");
    expect(text).toContain("Watch on");
    expect(text).toContain("https://www.pawelperfect.com/en?v=moj-film");
    expect(text).toContain("_blank");
    expect(text).toContain("noopener");
  });

  it("renders the card in the language the proxy named", async () => {
    h.language = "pl";
    h.findVideoForEmbed.mockResolvedValue(videoRow({ tier: "PAID" }));
    const text = visibleText(await render());
    expect(text).toContain("Obejrzyj na");
    expect(text).toContain("https://www.pawelperfect.com/pl?v=moj-film");
  });

  it("shows the same neutral card for a missing and for a hidden video", async () => {
    h.findVideoForEmbed.mockResolvedValue(null);
    const missing = visibleText(await render("nie-ma"));
    h.findVideoForEmbed.mockResolvedValue(videoRow({ status: "DRAFT", title: "Tajny szkic" }));
    const hidden = visibleText(await render("tajny"));
    expect(hidden).toBe(missing);
    expect(hidden).not.toContain("Tajny szkic");
    expect(hidden).toContain("Video unavailable");
  });

  it("is rate-limited per IP: a limited visitor gets the neutral card without any lookup", async () => {
    h.rateLimit.mockResolvedValue({ success: false, remaining: 0 });
    const tree = await render();
    expect(tree.type).not.toBe(EmbedPlayerStub);
    expect(h.rateLimit).toHaveBeenCalledWith(expect.objectContaining({ key: "embed-page:1.2.3.4" }));
    expect(h.findVideoForEmbed).not.toHaveBeenCalled();
  });

  it("keeps working when the limiter is down", async () => {
    h.rateLimit.mockRejectedValue(new Error("redis down"));
    expect((await render()).type).toBe(EmbedPlayerStub);
  });
});
