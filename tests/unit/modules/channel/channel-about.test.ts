import { beforeEach, describe, expect, it, vi } from "vitest";

const audit = vi.hoisted(() => ({ recordAuditEvent: vi.fn(async () => ({})) }));
vi.mock("@/lib/modules/audit", () => ({
  recordAuditEvent: audit.recordAuditEvent,
  recordAuditEventSafe: vi.fn(),
}));

import { createAppContext, type AppContext } from "@/lib/modules/shared/app-context";
import type { Actor } from "@/lib/modules/shared/actor";
import {
  CHANNEL_LINKS_MAX,
  bannerRouteUrl,
  getChannelAboutSettings,
  getPublicChannelBanner,
  normalizeChannelLinkUrl,
  normalizeChannelLinks,
  normalizeContactEmail,
  parseStoredChannelLinks,
  setChannelBanner,
  toPublicChannelAbout,
  updateChannelAbout,
  validateBannerDataUrl,
  validateBannerFile,
} from "@/lib/modules/channel";

const NOW = new Date("2026-10-19T12:00:00Z");
type Row = Record<string, unknown>;

// 1x1 transparent PNG and a tiny JPEG header: enough for the signature check.
const PNG = "data:image/png;base64," + Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]).toString("base64");
const JPEG = "data:image/jpeg;base64," + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString("base64");

const channel = { id: "ch-1", slug: "kanal", handle: "kanal", name: "Kanał", userId: "u-owner", status: "ACTIVE", deletedAt: null, deleteAfter: null };

function makeCtx(actor: Actor, members: Row[] = []) {
  const db = {
    creator: {
      findUnique: vi.fn(async () => ({ ...channel, members: members.filter((m) => m.userId === (actor as { userId?: string }).userId), links: [], publicContactEmail: null, bannerUpdatedAt: null })),
      update: vi.fn(async ({ data }: { data: Row }) => ({ id: "ch-1", links: [], publicContactEmail: null, bannerUpdatedAt: null, ...data })),
    },
    channelMember: { findMany: vi.fn(async () => members), findFirst: vi.fn(async () => members[0] ?? null), findUnique: vi.fn(async () => members[0] ?? null) },
    channelBanner: { upsert: vi.fn(async () => ({})), deleteMany: vi.fn(async () => ({ count: 1 })), findFirst: vi.fn() },
  };
  const ctx = createAppContext({ actor, prisma: db as never, now: () => NOW, channelId: "ch-1" }) as AppContext;
  return { ctx, db };
}

const owner: Actor = { type: "user", userId: "u-owner" };
const stranger: Actor = { type: "user", userId: "u-stranger" };

beforeEach(() => audit.recordAuditEvent.mockClear());

describe("channel links validation", () => {
  it("accepts https links and normalizes them", () => {
    const result = normalizeChannelLinks([{ title: "  Mój   sklep ", url: "https://example.com/shop" }]);
    expect(result).toEqual({ ok: true, links: [{ title: "Mój sklep", url: "https://example.com/shop" }] });
  });

  it("ignores empty rows and rejects more than the maximum", () => {
    expect(normalizeChannelLinks([{ title: "", url: "" }])).toEqual({ ok: true, links: [] });
    const many = Array.from({ length: CHANNEL_LINKS_MAX + 1 }, (_, i) => ({ title: `L${i}`, url: `https://example.com/${i}` }));
    expect(normalizeChannelLinks(many)).toEqual({ ok: false, problem: "TOO_MANY_LINKS" });
  });

  it.each([
    ["http://example.com", "LINK_NOT_HTTPS"],
    ["javascript:alert(1)", "LINK_NOT_HTTPS"],
    ["//example.com", "LINK_URL"],
    ["https://user:pass@example.com", "LINK_URL"],
    ["https://localhost/x", "LINK_HOST"],
    ["https://127.0.0.1/x", "LINK_HOST"],
    ["https://192.168.1.4/x", "LINK_HOST"],
    ["https://intranet/x", "LINK_HOST"],
    ["not a url", "LINK_URL"],
  ])("rejects %s", (url, problem) => {
    expect(normalizeChannelLinkUrl(url)).toEqual({ ok: false, problem });
  });

  it("requires a title of at most 40 characters and rejects duplicates", () => {
    expect(normalizeChannelLinks([{ title: "", url: "https://example.com" }])).toEqual({ ok: false, problem: "LINK_TITLE" });
    expect(normalizeChannelLinks([{ title: "x".repeat(41), url: "https://example.com" }])).toEqual({ ok: false, problem: "LINK_TITLE" });
    expect(
      normalizeChannelLinks([
        { title: "A", url: "https://example.com/a" },
        { title: "B", url: "https://example.com/a" },
      ]),
    ).toEqual({ ok: false, problem: "LINK_DUPLICATE" });
  });

  it("drops malformed stored links when reading", () => {
    expect(parseStoredChannelLinks([{ title: "ok", url: "https://example.com" }, { title: "bad", url: "http://example.com" }, "x", null])).toEqual([
      { title: "ok", url: "https://example.com/" },
    ]);
    expect(parseStoredChannelLinks("nope")).toEqual([]);
  });
});

describe("contact e-mail", () => {
  it("is empty by default and validates the format", () => {
    expect(normalizeContactEmail("")).toEqual({ ok: true, email: null });
    expect(normalizeContactEmail(null)).toEqual({ ok: true, email: null });
    expect(normalizeContactEmail(" kontakt@example.com ")).toEqual({ ok: true, email: "kontakt@example.com" });
    expect(normalizeContactEmail("zly adres")).toEqual({ ok: false, problem: "EMAIL" });
  });
});

describe("banner constraints", () => {
  it("accepts only image types within the size limit", () => {
    expect(validateBannerFile({ type: "image/png", size: 1000 })).toBeNull();
    expect(validateBannerFile({ type: "image/gif", size: 1000 })).toBe("type");
    expect(validateBannerFile({ type: "image/jpeg", size: 5 * 1024 * 1024 })).toBe("size");
  });

  it("checks the data URL signature, type and size on the server", () => {
    expect(validateBannerDataUrl(PNG).ok).toBe(true);
    expect(validateBannerDataUrl(JPEG).ok).toBe(true);
    // Declared PNG, JPEG bytes inside.
    expect(validateBannerDataUrl(PNG.replace("png", "jpeg")).ok).toBe(false);
    expect(validateBannerDataUrl("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=").ok).toBe(false);
    expect(validateBannerDataUrl("data:image/jpeg;base64," + "A".repeat(400_001)).ok).toBe(false);
    expect(validateBannerDataUrl(42).ok).toBe(false);
  });

  it("builds a versioned public address", () => {
    expect(bannerRouteUrl("ch-1", NOW)).toBe(`/api/channel-banners/ch-1?v=${NOW.getTime()}`);
  });
});

describe("updateChannelAbout", () => {
  it("lets the owner save links and a contact e-mail and writes an audit event without the values", async () => {
    const { ctx, db } = makeCtx(owner);
    const result = await updateChannelAbout(ctx, { links: [{ title: "Sklep", url: "https://example.com" }], contactEmail: "kontakt@example.com" });
    expect(result.ok).toBe(true);
    expect(db.creator.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { links: [{ title: "Sklep", url: "https://example.com/" }], publicContactEmail: "kontakt@example.com" } }),
    );
    const event = (audit.recordAuditEvent.mock.calls[0] as unknown as [unknown, { action: string; metadata: Row }])[1];
    expect(event.action).toBe("CHANNEL_ABOUT_UPDATED");
    expect(JSON.stringify(event.metadata)).not.toContain("example.com");
  });

  it("lets a MANAGER edit and refuses an EDITOR and a stranger", async () => {
    const manager = makeCtx({ type: "user", userId: "u-manager" }, [{ channelId: "ch-1", userId: "u-manager", role: "MANAGER", acceptedAt: NOW }]);
    expect((await updateChannelAbout(manager.ctx, { contactEmail: null })).ok).toBe(true);

    const editor = makeCtx({ type: "user", userId: "u-editor" }, [{ channelId: "ch-1", userId: "u-editor", role: "EDITOR", acceptedAt: NOW }]);
    const refusedEditor = await updateChannelAbout(editor.ctx, { contactEmail: null });
    expect(refusedEditor.ok).toBe(false);
    expect(editor.db.creator.update).not.toHaveBeenCalled();

    const outsider = makeCtx(stranger);
    expect((await updateChannelAbout(outsider.ctx, { contactEmail: null })).ok).toBe(false);
    expect(outsider.db.creator.update).not.toHaveBeenCalled();
    expect(audit.recordAuditEvent).toHaveBeenCalledTimes(1 + 0);
  });

  it("returns a validation error for a bad link and writes nothing", async () => {
    const { ctx, db } = makeCtx(owner);
    const result = await updateChannelAbout(ctx, { links: [{ title: "x", url: "http://example.com" }] });
    expect(!result.ok && result.error.code).toBe("CHANNEL_ABOUT_LINK_NOT_HTTPS");
    expect(db.creator.update).not.toHaveBeenCalled();
    expect(audit.recordAuditEvent).not.toHaveBeenCalled();
  });

  it("hides the settings from a guest", async () => {
    const { ctx } = makeCtx({ type: "guest" });
    expect((await getChannelAboutSettings(ctx)).ok).toBe(false);
  });
});

describe("setChannelBanner", () => {
  it("stores a valid banner, stamps the channel and audits it", async () => {
    const { ctx, db } = makeCtx(owner);
    const result = await setChannelBanner(ctx, { dataUrl: PNG });
    expect(result.ok && result.data.bannerUrl).toBe(`/api/channel-banners/ch-1?v=${NOW.getTime()}`);
    expect(db.channelBanner.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { channelId: "ch-1" } }));
    expect((audit.recordAuditEvent.mock.calls[0] as unknown as [unknown, { action: string }])[1].action).toBe("CHANNEL_BANNER_CHANGED");
  });

  it("rejects an invalid image and removes on null", async () => {
    const bad = makeCtx(owner);
    const refused = await setChannelBanner(bad.ctx, { dataUrl: "data:image/gif;base64,R0lGOA==" });
    expect(!refused.ok && refused.error.code).toBe("CHANNEL_BANNER_INVALID");
    expect(bad.db.channelBanner.upsert).not.toHaveBeenCalled();

    const removal = makeCtx(owner);
    const removed = await setChannelBanner(removal.ctx, { dataUrl: null });
    expect(removed.ok && removed.data.bannerUrl).toBeNull();
    expect(removal.db.channelBanner.deleteMany).toHaveBeenCalled();
    expect((audit.recordAuditEvent.mock.calls.at(-1) as unknown as [unknown, { action: string }])[1].action).toBe("CHANNEL_BANNER_REMOVED");
  });

  it("refuses a stranger", async () => {
    const { ctx, db } = makeCtx(stranger);
    expect((await setChannelBanner(ctx, { dataUrl: PNG })).ok).toBe(false);
    expect(db.channelBanner.upsert).not.toHaveBeenCalled();
  });
});

describe("getPublicChannelBanner", () => {
  it("serves only the banner of a publicly visible channel", async () => {
    const { ctx, db } = makeCtx({ type: "guest" });
    db.channelBanner.findFirst.mockResolvedValueOnce({ mime: "image/png", data: Buffer.from([1]), channel: { status: "ACTIVE", deletedAt: null } });
    expect(await getPublicChannelBanner(ctx, "ch-1")).toEqual({ mime: "image/png", data: Buffer.from([1]) });
    db.channelBanner.findFirst.mockResolvedValueOnce({ mime: "image/png", data: Buffer.from([1]), channel: { status: "SUSPENDED", deletedAt: null } });
    expect(await getPublicChannelBanner(ctx, "ch-1")).toBeNull();
    db.channelBanner.findFirst.mockResolvedValueOnce({ mime: "text/html", data: Buffer.from([1]), channel: { status: "ACTIVE", deletedAt: null } });
    expect(await getPublicChannelBanner(ctx, "ch-1")).toBeNull();
  });
});

describe("toPublicChannelAbout (public DTO)", () => {
  it("exposes only the allowlisted fields", () => {
    const row = {
      id: "ch-1",
      createdAt: new Date("2025-01-02T00:00:00Z"),
      links: [{ title: "Sklep", url: "https://example.com/" }],
      publicContactEmail: "kontakt@example.com",
      bannerUpdatedAt: NOW,
      // Things that must never leak even if the caller passes the whole row.
      userId: "u-owner",
      statusReason: "internal",
      user: { email: "private@example.com" },
    };
    const dto = toPublicChannelAbout(row, [{ views: 10 }, { views: 5 }, {}]);
    expect(Object.keys(dto).sort()).toEqual(["bannerImageUrl", "contactEmail", "joinedAt", "links", "totalViews"]);
    expect(dto.totalViews).toBe(15);
    expect(dto.joinedAt).toBe("2025-01-02T00:00:00.000Z");
    expect(JSON.stringify(dto)).not.toContain("private@example.com");
    expect(JSON.stringify(dto)).not.toContain("u-owner");
  });

  it("shows no contact e-mail unless the creator set one, and no banner without upload", () => {
    const dto = toPublicChannelAbout({ id: "ch-1", createdAt: NOW, publicContactEmail: null, bannerUpdatedAt: null }, []);
    expect(dto.contactEmail).toBeNull();
    expect(dto.bannerImageUrl).toBeNull();
    expect(dto.links).toEqual([]);
  });
});
