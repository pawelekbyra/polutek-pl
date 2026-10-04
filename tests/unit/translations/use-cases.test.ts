import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  updateAdminVideo: vi.fn(async () => ({ ok: true, data: {} })),
  audit: vi.fn(async () => undefined),
}));
vi.mock("@/lib/modules/video", () => ({ updateAdminVideo: m.updateAdminVideo }));
vi.mock("@/lib/modules/audit", () => ({ recordAuditEventSafe: m.audit }));
vi.mock("@/lib/modules/channel", () => ({ MainChannelService: { getRequired: async () => ({ id: "c1" }) } }));

import { approveFilmTranslations, listFilmTranslations, saveFilmTranslation } from "@/lib/modules/translations";
import type { AppContext } from "@/lib/modules/shared/app-context";

type Tr = { id: string; videoId: string; language: string; title: string; slug: string; description: string | null; subtitleUrl: string | null; status: string; reviewedAt: Date | null; reviewedById: string | null; updatedAt: Date };

function fakeDb(initial: Tr[] = [], history: { videoId: string; language: string; slug: string }[] = []) {
  const rows = [...initial];
  const hist = [...history];
  const video = { id: "v1", slug: "kulisy", title: "Kulisy", description: "Opis", subtitleUrlPl: null, subtitleUrlEn: "https://t/en.vtt", titleEn: null as string | null, descriptionEn: null, updatedAt: new Date() };
  const match = (r: Record<string, unknown>, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => (v && typeof v === "object" && "not" in (v as object) ? r[k] !== (v as { not: unknown }).not : r[k] === v));
  const prisma = {
    video: { findFirst: vi.fn(async () => video) },
    videoTranslation: {
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => rows.filter((r) => match(r, where))),
      count: vi.fn(async ({ where }: { where: Record<string, unknown> }) => rows.filter((r) => match(r, where)).length),
      findUnique: vi.fn(async ({ where }: { where: { videoId_language: { videoId: string; language: string } } }) => rows.find((r) => r.videoId === where.videoId_language.videoId && r.language === where.videoId_language.language) ?? null),
      upsert: vi.fn(async ({ where, create, update }: { where: { videoId_language: { videoId: string; language: string } }; create: Tr; update: Partial<Tr> }) => {
        const i = rows.findIndex((r) => r.videoId === where.videoId_language.videoId && r.language === where.videoId_language.language);
        if (i >= 0) Object.assign(rows[i], update);
        else rows.push({ id: `t${rows.length}`, updatedAt: new Date(), reviewedAt: null, reviewedById: null, subtitleUrl: null, description: null, ...create });
      }),
      updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<Tr> }) => {
        const hit = rows.filter((r) => match(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      }),
    },
    videoSlugHistory: {
      count: vi.fn(async ({ where }: { where: Record<string, unknown> }) => hist.filter((r) => match(r, where)).length),
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => hist.filter((r) => match(r, where))),
      createMany: vi.fn(async ({ data }: { data: typeof hist }) => void hist.push(...data)),
    },
  };
  const ctx = { prisma, actor: { type: "admin", userId: "adm1" }, db: { writeTransaction: async (fn: (tx: unknown) => unknown) => fn(prisma) } } as unknown as AppContext;
  return { ctx, rows, hist, video };
}

const tr = (over: Partial<Tr>): Tr => ({ id: "x", videoId: "other", language: "de", title: "T", slug: "s", description: null, subtitleUrl: null, status: "EDITED", reviewedAt: null, reviewedById: null, updatedAt: new Date(), ...over });

beforeEach(() => vi.clearAllMocks());

describe("saveFilmTranslation", () => {
  it("creates a human-written translation with an address from the translated title, avoiding taken ones", async () => {
    const { ctx, rows } = fakeDb([tr({ slug: "hinter-den-kulissen" })], [{ videoId: "other", language: "de", slug: "hinter-den-kulissen-2" }]);
    const r = await saveFilmTranslation({ videoId: "v1", language: "de", title: "Hinter den Kulissen" }, ctx);
    expect(r).toEqual({ ok: true, data: { slug: "hinter-den-kulissen-3" } });
    expect(rows.find((x) => x.videoId === "v1")).toMatchObject({ status: "EDITED", reviewedById: "adm1" });
    expect(m.updateAdminVideo).not.toHaveBeenCalled();
  });

  it("an address change of an existing translation goes to the history", async () => {
    const { ctx, hist } = fakeDb([tr({ videoId: "v1", language: "fr", slug: "coulisses", status: "AI_DRAFT" })]);
    const r = await saveFilmTranslation({ videoId: "v1", language: "fr", title: "Coulisses", slug: "les-coulisses" }, ctx);
    expect(r.ok).toBe(true);
    expect(hist).toContainEqual({ videoId: "v1", language: "fr", slug: "coulisses" });
  });

  it("refuses an address another film has in that language (also an old one)", async () => {
    const { ctx } = fakeDb([], [{ videoId: "other", language: "fr", slug: "coulisses" }]);
    const r = await saveFilmTranslation({ videoId: "v1", language: "fr", title: "Coulisses", slug: "coulisses" }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("TRANSLATION_SLUG_CONFLICT");
  });

  it("keeps English in sync with the Video EN columns the site reads today", async () => {
    const { ctx } = fakeDb();
    await saveFilmTranslation({ videoId: "v1", language: "en", title: "Backstage", description: " About " }, ctx);
    expect(m.updateAdminVideo).toHaveBeenCalledWith({ id: "v1", titleEn: "Backstage", descriptionEn: "About" }, ctx);
  });

  it("refuses Polish (the original), unknown languages and an empty title", async () => {
    const { ctx } = fakeDb();
    for (const input of [{ language: "pl", title: "x" }, { language: "ru", title: "x" }, { language: "de", title: "  " }]) {
      const r = await saveFilmTranslation({ videoId: "v1", ...input }, ctx);
      expect(r.ok).toBe(false);
    }
  });
});

describe("approveFilmTranslations", () => {
  it("approves machine drafts only, one language or all", async () => {
    const { ctx, rows } = fakeDb([tr({ videoId: "v1", language: "de", status: "AI_DRAFT" }), tr({ videoId: "v1", language: "fr", status: "AI_DRAFT" }), tr({ videoId: "v1", language: "en", status: "EDITED" })]);
    expect(await approveFilmTranslations({ videoId: "v1", language: "de" }, ctx)).toEqual({ ok: true, data: { approved: 1 } });
    expect(await approveFilmTranslations({ videoId: "v1" }, ctx)).toEqual({ ok: true, data: { approved: 1 } });
    expect(rows.map((r) => r.status)).toEqual(["APPROVED", "APPROVED", "EDITED"]);
    expect(rows[0].reviewedById).toBe("adm1");
  });
});

describe("listFilmTranslations", () => {
  it("lists every language and shows old EN columns as a human-written English version", async () => {
    const { ctx, video } = fakeDb([tr({ videoId: "v1", language: "de", status: "AI_DRAFT" })]);
    video.titleEn = "Backstage";
    const r = await listFilmTranslations("kulisy", ctx);
    if (!r.ok) throw new Error("expected ok");
    expect(r.data.rows).toHaveLength(7);
    expect(r.data.rows[0].translation).toMatchObject({ title: "Backstage", status: "EDITED", subtitleUrl: "https://t/en.vtt" });
    expect(r.data.rows[1].translation).toMatchObject({ status: "AI_DRAFT" });
    expect(r.data.rows[2].translation).toBeNull();
  });
});
