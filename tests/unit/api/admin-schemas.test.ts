import { describe, expect, it } from "vitest";
import * as s from "@/lib/api/admin-schemas";
import { parseAdminBody } from "@/lib/api/admin-body";

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) => schema.safeParse(v).success;

describe("admin schemas", () => {
  it("comment report resolve", () => {
    expect(ok(s.adminCommentReportResolveSchema, { status: "DISMISSED" })).toBe(true);
    expect(ok(s.adminCommentReportResolveSchema, { status: "ACTION_TAKEN", extra: 1 })).toBe(true);
    expect(ok(s.adminCommentReportResolveSchema, { status: "OPEN" })).toBe(false);
    expect(ok(s.adminCommentReportResolveSchema, {})).toBe(false);
  });

  it("comment delete: reason optional", () => {
    expect(ok(s.adminCommentDeleteSchema, {})).toBe(true);
    expect(ok(s.adminCommentDeleteSchema, { reason: "SPAM" })).toBe(true);
    expect(ok(s.adminCommentDeleteSchema, { reason: "BOGUS" })).toBe(false);
  });

  it("video premiereAt: ISO timestamp, null (publish now) or absent", () => {
    expect(ok(s.adminVideoPremiereAtSchema, "2026-12-31T19:00:00.000Z")).toBe(true);
    expect(ok(s.adminVideoPremiereAtSchema, "2026-12-31T20:00:00+01:00")).toBe(true);
    expect(ok(s.adminVideoPremiereAtSchema, null)).toBe(true);
    expect(ok(s.adminVideoPremiereAtSchema, undefined)).toBe(true);
    // datetime-local values without an offset, dates only and junk are rejected.
    expect(ok(s.adminVideoPremiereAtSchema, "2026-12-31T20:00")).toBe(false);
    expect(ok(s.adminVideoPremiereAtSchema, "2026-12-31")).toBe(false);
    expect(ok(s.adminVideoPremiereAtSchema, "tomorrow")).toBe(false);
    expect(ok(s.adminVideoPremiereAtSchema, 1767207600000)).toBe(false);
  });

  it("video write keeps other metadata and validates premiereAt", () => {
    const parsed = s.adminVideoWriteSchema.safeParse({ title: "T", premiereAt: "2026-12-31T19:00:00.000Z" });
    expect(parsed.success && parsed.data).toEqual({ title: "T", premiereAt: "2026-12-31T19:00:00.000Z" });
    expect(ok(s.adminVideoWriteSchema, { title: "T" })).toBe(true);
    expect(ok(s.adminVideoWriteSchema, { premiereAt: "nope" })).toBe(false);
  });

  it("broadcast create needs Polish content and a request key, and accepts no recipient list", () => {
    const base = { subjectPl: "Nowy film", htmlPl: "<p>Hej</p>", requestKey: "6f1c1f9e-6c8c-4d8e-9a59-2f8f1b2b9c11" };
    expect(ok(s.adminBroadcastCreateSchema, base)).toBe(true);
    expect(ok(s.adminBroadcastCreateSchema, { ...base, requestKey: "not-a-uuid" })).toBe(false);
    expect(ok(s.adminBroadcastCreateSchema, { ...base, subjectPl: " " })).toBe(false);
    const parsed = s.adminBroadcastCreateSchema.safeParse({ ...base, manualEmails: "x@example.com", audience: "PATRONS" });
    expect(parsed.success && Object.keys(parsed.data).sort()).toEqual(["htmlPl", "requestKey", "subjectPl"]);
  });

  it("broadcast test takes a language and no recipient address", () => {
    const parsed = s.adminBroadcastTestSchema.safeParse({ subjectPl: "a", htmlPl: "b", testEmail: "anyone@example.com" });
    expect(parsed.success && parsed.data).toEqual({ subjectPl: "a", htmlPl: "b", language: "pl" });
    expect(ok(s.adminBroadcastTestSchema, { subjectPl: "a", htmlPl: "b", language: "de" })).toBe(false);
  });

  it("email template", () => {
    expect(ok(s.adminEmailTemplateSchema, { slug: "welcome-email", subject: "S", html: "<p>x</p>" })).toBe(true);
    expect(ok(s.adminEmailTemplateSchema, { slug: "Bad Slug", subject: "S", html: "x" })).toBe(false);
  });

  it("notification broadcast", () => {
    const base = { titlePl: "a", titleEn: "b", bodyPl: "c", bodyEn: "d", audience: "ALL" };
    expect(ok(s.adminNotificationBroadcastSchema, base)).toBe(true);
    expect(ok(s.adminNotificationBroadcastSchema, { ...base, href: null })).toBe(true);
    expect(ok(s.adminNotificationBroadcastSchema, { ...base, audience: "NOBODY" })).toBe(false);
    expect(ok(s.adminNotificationBroadcastSchema, { ...base, titlePl: "" })).toBe(false);
    expect(s.adminNotificationBroadcastSchema.parse({ ...base, href: null }).href).toBeUndefined();
  });

  it("notification template", () => {
    const base = { kind: "WELCOME", titlePl: "a", titleEn: "b", bodyPl: "c", bodyEn: "d" };
    expect(ok(s.adminNotificationTemplateSchema, base)).toBe(true);
    expect(ok(s.adminNotificationTemplateSchema, { ...base, bodyEn: "" })).toBe(false);
  });

  it("payment refund: empty body is a full refund", () => {
    expect(ok(s.adminPaymentRefundSchema, {})).toBe(true);
    expect(ok(s.adminPaymentRefundSchema, { amountMinor: 500 })).toBe(true);
    expect(ok(s.adminPaymentRefundSchema, { amountMinor: -1 })).toBe(false);
    expect(ok(s.adminPaymentRefundSchema, { amountMinor: 1.5 })).toBe(false);
    expect(ok(s.adminPaymentRefundSchema, { amountMinor: "5" })).toBe(false);
  });

  it("patron action", () => {
    expect(ok(s.adminPatronActionSchema, { action: "grant", reason: "x" })).toBe(true);
    expect(ok(s.adminPatronActionSchema, { action: "revoke", note: "x" })).toBe(true);
    expect(ok(s.adminPatronActionSchema, { action: "delete" })).toBe(false);
  });

  it("reorder / resync", () => {
    expect(ok(s.adminVideoReorderSchema, { videos: [{ id: "a", sidebarOrder: 1, showInSidebar: true }] })).toBe(true);
    expect(ok(s.adminVideoReorderSchema, { videos: [{ id: "a" }] })).toBe(false);
    expect(ok(s.adminVideoReorderSchema, {})).toBe(false);
    expect(ok(s.adminVideoResyncSchema, { videoId: "v" })).toBe(true);
    expect(ok(s.adminVideoResyncSchema, { videoId: "" })).toBe(false);
  });

  it("video action", () => {
    expect(ok(s.adminVideoActionSchema, { action: "publish" })).toBe(true);
    expect(ok(s.adminVideoActionSchema, { action: "explode" })).toBe(false);
    // Provider actions are gone with the providers.
    expect(ok(s.adminVideoActionSchema, { action: "sync-cloudflare" })).toBe(false);
    expect(ok(s.adminVideoActionSchema, { action: "import-legacy-to-cloudflare" })).toBe(false);
    expect(ok(s.adminVideoActionSchema, { action: "attach-asset" })).toBe(false);
  });

  it("loose object rejects arrays and scalars", () => {
    expect(ok(s.adminLooseObjectSchema, { a: 1 })).toBe(true);
    expect(ok(s.adminLooseObjectSchema, [])).toBe(false);
    expect(ok(s.adminLooseObjectSchema, "x")).toBe(false);
    expect(ok(s.adminLooseObjectSchema, null)).toBe(false);
  });
});

describe("parseAdminBody", () => {
  const post = (body: string) => new Request("http://x", { method: "POST", body });

  it("returns 400 with details on invalid data", async () => {
    const r = await parseAdminBody(post('{"status":"x"}'), s.adminCommentReportResolveSchema, { errorMessage: "Invalid status" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(400);
      const json = await r.response.json();
      expect(json.error).toBe("Invalid status");
      expect(json.details).toBeDefined();
    }
  });

  it("returns 400 on invalid JSON unless allowEmpty", async () => {
    const bad = await parseAdminBody(post("not json"), s.adminPaymentRefundSchema);
    expect(bad.ok).toBe(false);
    const empty = await parseAdminBody(post(""), s.adminPaymentRefundSchema, { allowEmpty: true });
    expect(empty).toEqual({ ok: true, data: {} });
  });

  it("allowEmpty rejects malformed/truncated JSON (refund must not become a full refund)", async () => {
    const r = await parseAdminBody(post('{"amountMinor": 50'), s.adminPaymentRefundSchema, { allowEmpty: true });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(400);
      expect((await r.response.json()).error).toBe("Invalid JSON body");
    }
  });

  it("strips unknown fields", async () => {
    const r = await parseAdminBody(post('{"status":"DISMISSED","junk":1}'), s.adminCommentReportResolveSchema);
    expect(r).toEqual({ ok: true, data: { status: "DISMISSED" } });
  });
});
