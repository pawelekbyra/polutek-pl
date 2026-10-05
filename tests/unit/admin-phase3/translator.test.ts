import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/feature-flags", () => ({ flags: { mainCreatorSlug: "main" } }));
const audit = vi.hoisted(() => ({ recordAuditEventSafe: vi.fn(async () => undefined), recordAuditEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/modules/audit", () => audit);
vi.mock("@/lib/modules/video", () => ({ updateAdminVideo: vi.fn(async () => ({ ok: true, data: {} })) }));
const prismaMock = vi.hoisted(() => ({ adminSession: { findUnique: vi.fn() }, adminUser: { findUnique: vi.fn() }, adminLanguageGrant: { findMany: vi.fn(async () => []) } }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { approveFilmTranslations, createWorkersAiProvider, draftAiStatus, DraftProviderError, generateTranslationDrafts, listTranslationQueue, saveFilmTranslation, type TranslationDraftProvider } from "@/lib/modules/translations";
import { isTranslatorPath, lookupSessionRole, normalizeRole } from "@admin/lib/auth/roles";
import { proxy } from "../../../apps/admin/proxy";
import type { AppContext } from "@/lib/modules/shared/app-context";

const video = { id: "v1", slug: "film", title: "Mój film", description: "Opis filmu", subtitleUrlPl: null, subtitleUrlEn: null, titleEn: null, descriptionEn: null, updatedAt: new Date("2026-10-01T10:00:00Z") };

function mk(over: { allowed?: string[]; existing?: object[] } = {}) {
  const upsert = vi.fn(async () => undefined);
  const prisma = {
    creator: { findUnique: vi.fn(async () => ({ id: "ch", slug: "main", isApproved: true, isPrimary: true, userId: "u" })) },
    video: { findFirst: vi.fn(async () => video), findMany: vi.fn(async () => [video, { ...video, id: "v2", slug: "drugi", title: "Drugi" }]) },
    videoTranslation: { findUnique: vi.fn(async () => null), findMany: vi.fn(async () => over.existing ?? []), upsert, updateMany: vi.fn(async () => ({ count: 2 })) },
    videoSlugHistory: { findMany: vi.fn(async () => []), createMany: vi.fn() },
  };
  const ctx = { actor: { type: "admin", userId: "a1" }, prisma, allowedLanguages: over.allowed, now: () => new Date(), db: { read: prisma, writeTransaction: async (fn: (t: unknown) => unknown) => fn(prisma) } } as unknown as AppContext;
  return { ctx, prisma, upsert };
}

beforeEach(() => vi.clearAllMocks());

describe("language grants", () => {
  it("a translator may save a granted language and is refused any other", async () => {
    const { ctx, upsert } = mk({ allowed: ["de"] });
    expect(await saveFilmTranslation({ videoId: "v1", language: "de", title: "Mein Film" }, ctx)).toMatchObject({ ok: true });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(await saveFilmTranslation({ videoId: "v1", language: "fr", title: "Mon film" }, ctx)).toMatchObject({ ok: false, error: { code: "LANGUAGE_NOT_GRANTED" } });
    expect(upsert).toHaveBeenCalledTimes(1);
  });
  it("an owner (no restriction) may save any language", async () => {
    const { ctx } = mk();
    expect(await saveFilmTranslation({ videoId: "v1", language: "fr", title: "Mon film" }, ctx)).toMatchObject({ ok: true });
  });
  it("a translator can never approve", async () => {
    const { ctx, prisma } = mk({ allowed: ["de"] });
    expect(await approveFilmTranslations({ videoId: "v1", language: "de" }, ctx)).toMatchObject({ ok: false, error: { code: "APPROVAL_NOT_GRANTED" } });
    expect(prisma.videoTranslation.updateMany).not.toHaveBeenCalled();
  });
  it("the queue lists only granted languages and puts unfinished films first", async () => {
    const { ctx } = mk({ existing: [{ videoId: "v1", language: "de", status: "APPROVED" }] });
    const q = await listTranslationQueue(["de", "es"], ctx);
    expect(q.map((i) => i.slug)).toEqual(["drugi", "film"]);
    expect(q[0].languages.map((l) => l.code)).toEqual(["de", "es"]);
    expect(await listTranslationQueue([], ctx)).toEqual([]);
  });
});

describe("roles and the proxy", () => {
  it("anything but OWNER is the least privileged role", () => {
    expect(normalizeRole("OWNER")).toBe("OWNER");
    for (const r of ["TRANSLATOR", "owner", "", null, undefined, "ADMIN"]) expect(normalizeRole(r)).toBe("TRANSLATOR");
  });
  it("translator paths are an explicit short list", () => {
    for (const p of ["/tlumaczenia", "/tlumaczenia/film", "/api/auth/get-session", "/potwierdz"]) expect(isTranslatorPath(p)).toBe(true);
    for (const p of ["/", "/tresci", "/tresci/film/tlumaczenia", "/przychody", "/api/export/payments", "/tlumaczeniaX", "/api/videos/1/cover"]) expect(isTranslatorPath(p)).toBe(false);
  });
  it("looks the role up by the token part of the cookie and knows nothing about unknown sessions", async () => {
    prismaMock.adminSession.findUnique.mockResolvedValue({ user: { role: "TRANSLATOR" } });
    expect(await lookupSessionRole("tok123.c2ln%3D")).toBe("TRANSLATOR");
    expect(prismaMock.adminSession.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { token: "tok123" } }));
    prismaMock.adminSession.findUnique.mockResolvedValue(null);
    expect(await lookupSessionRole("zzz.sig")).toBeNull();
    expect(await lookupSessionRole(undefined)).toBeNull();
  });

  const devReq = (path: string, cookie = "ppadm.session_token=tok.sig") => new NextRequest(new URL(path, "https://admin.pawelperfect.com"), { headers: { cookie } });
  it("sends a translator away from owner pages (redirect) and APIs (403), but lets the translation screens through", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ADMIN_DEV_BYPASS_ACCESS", "1");
    vi.stubEnv("ADMIN_AUTH_MODE", "passkey"); // cookie-based role lookup is the legacy mode (access mode: access-proxy.test.ts)
    prismaMock.adminSession.findUnique.mockResolvedValue({ user: { role: "TRANSLATOR" } });
    const page = await proxy(devReq("/przychody"));
    expect(page.status).toBe(307);
    expect(page.headers.get("location")).toContain("/tlumaczenia");
    expect((await proxy(devReq("/api/export/payments"))).status).toBe(403);
    expect((await proxy(devReq("/tlumaczenia/film"))).status).toBe(200);
    vi.unstubAllEnvs();
  });
  it("does not touch an owner", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ADMIN_DEV_BYPASS_ACCESS", "1");
    vi.stubEnv("ADMIN_AUTH_MODE", "passkey"); // cookie-based role lookup is the legacy mode (access mode: access-proxy.test.ts)
    prismaMock.adminSession.findUnique.mockResolvedValue({ user: { role: "OWNER" } });
    expect((await proxy(devReq("/przychody"))).status).toBe(200);
    vi.unstubAllEnvs();
  });
});

describe("AI drafts", () => {
  const ENV = { TRANSLATION_AI_ENABLED: "1", CLOUDFLARE_AI_ACCOUNT_ID: "acc", CLOUDFLARE_AI_API_TOKEN: "tok" };
  const fake = (impl?: (t: string, to: string) => string): TranslationDraftProvider => ({ name: "fake", translate: vi.fn(async ({ text, to }) => (impl ? impl(text, to) : `[${to}] ${text}`)) });

  it("is OFF by default and says why, without revealing any value", () => {
    expect(draftAiStatus({})).toMatchObject({ enabled: false, reason: expect.stringContaining("TRANSLATION_AI_ENABLED") });
    expect(draftAiStatus({ TRANSLATION_AI_ENABLED: "1" }).reason).toContain("CLOUDFLARE_AI");
    expect(draftAiStatus(ENV).enabled).toBe(true);
  });

  it("refuses to run when disabled, for a translator, and never calls the provider", async () => {
    const p = fake();
    expect(await generateTranslationDrafts({ videoId: "v1" }, mk().ctx, p, {})).toMatchObject({ ok: false, error: { code: "AI_DISABLED" } });
    expect(await generateTranslationDrafts({ videoId: "v1" }, mk({ allowed: ["de"] }).ctx, p, ENV)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(p.translate).not.toHaveBeenCalled();
  });

  it("creates AI_DRAFT rows, never overwrites human or approved text, and audits the run", async () => {
    const { ctx, upsert } = mk({ existing: [{ language: "de", status: "EDITED", slug: "x" }, { language: "es", status: "APPROVED", slug: "y" }, { language: "fr", status: "AI_DRAFT", slug: "film-fr" }] });
    const r = await generateTranslationDrafts({ videoId: "v1", languages: ["de", "es", "fr", "it"] }, ctx, fake(), ENV);
    expect(r.ok && r.data.created.sort()).toEqual(["fr", "it"]);
    expect(r.ok && r.data.skipped.map((s) => s.language).sort()).toEqual(["de", "es"]);
    const calls = upsert.mock.calls as unknown as [{ where: { videoId_language: { language: string } }; create: { status: string; title: string }; update: { status: string } }][];
    expect(calls.map((c) => c[0].where.videoId_language.language).sort()).toEqual(["fr", "it"]);
    expect(calls.every((c) => c[0].create.status === "AI_DRAFT" && c[0].update.status === "AI_DRAFT")).toBe(true);
    expect(calls.find((c) => c[0].where.videoId_language.language === "it")![0].create.title).toBe("[it] Mój film");
    expect(audit.recordAuditEventSafe).toHaveBeenCalledWith(ctx, expect.objectContaining({ action: "TRANSLATION_AI_DRAFTS_GENERATED", metadata: expect.objectContaining({ created: expect.any(Array) }) }));
  });

  it("stops at the first quota error and reports it", async () => {
    const { ctx, upsert } = mk();
    let n = 0;
    const p: TranslationDraftProvider = { name: "q", translate: vi.fn(async () => { if (++n > 2) throw new DraftProviderError("limit", "quota"); return "ok"; }) };
    const r = await generateTranslationDrafts({ videoId: "v1", languages: ["de", "es", "fr"] }, ctx, p, ENV);
    expect(r.ok && r.data.stoppedBy).toBe("quota");
    expect(r.ok && r.data.created).toEqual(["de"]);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("skips English typed by hand into the old fields", async () => {
    const { ctx, prisma } = mk();
    prisma.video.findFirst.mockResolvedValue({ ...video, titleEn: "My film" } as never);
    const r = await generateTranslationDrafts({ videoId: "v1", languages: ["en"] }, ctx, fake(), ENV);
    expect(r.ok && r.data.created).toEqual([]);
  });
});

describe("Workers AI provider (fetch mocked, no network)", () => {
  const ok = (text: string) => new Response(JSON.stringify({ success: true, result: { translated_text: text } }), { status: 200 });
  it("posts text and languages with the bearer token to the account endpoint", async () => {
    const f = vi.fn(async () => ok(" Mein Film "));
    const p = createWorkersAiProvider({ CLOUDFLARE_AI_ACCOUNT_ID: "acc1", CLOUDFLARE_AI_API_TOKEN: "tok1" }, f as never);
    expect(await p.translate({ text: "Mój film", from: "pl", to: "de" })).toBe("Mein Film");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/acc1/ai/run/@cf/meta/m2m100-1.2b");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok1");
    expect(JSON.parse(init.body as string)).toEqual({ text: "Mój film", source_lang: "pl", target_lang: "de" });
  });
  it("maps the free-limit errors to a quota error and other failures to unavailable", async () => {
    const env = { CLOUDFLARE_AI_ACCOUNT_ID: "a", CLOUDFLARE_AI_API_TOKEN: "t" };
    const quota = createWorkersAiProvider(env, (async () => new Response("{}", { status: 429 })) as never);
    await expect(quota.translate({ text: "x", from: "pl", to: "de" })).rejects.toMatchObject({ kind: "quota" });
    const code4006 = createWorkersAiProvider(env, (async () => new Response(JSON.stringify({ success: false, errors: [{ code: 4006 }] }), { status: 400 })) as never);
    await expect(code4006.translate({ text: "x", from: "pl", to: "de" })).rejects.toMatchObject({ kind: "quota" });
    const down = createWorkersAiProvider(env, (async () => { throw new Error("net"); }) as never);
    await expect(down.translate({ text: "x", from: "pl", to: "de" })).rejects.toMatchObject({ kind: "unavailable" });
    const empty = createWorkersAiProvider(env, (async () => ok("")) as never);
    await expect(empty.translate({ text: "x", from: "pl", to: "de" })).rejects.toMatchObject({ kind: "bad_response" });
    expect(() => createWorkersAiProvider({}, fetch)).toThrow();
  });
});
