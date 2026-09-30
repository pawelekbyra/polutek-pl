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

  it("inbound email patch", () => {
    expect(ok(s.adminInboundEmailPatchSchema, { id: "1", status: "READ" })).toBe(true);
    expect(ok(s.adminInboundEmailPatchSchema, { id: "", status: "READ" })).toBe(false);
    expect(ok(s.adminInboundEmailPatchSchema, { id: "1", status: "WHATEVER" })).toBe(false);
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

  it("probe", () => {
    expect(ok(s.adminProbeSchema, { probe: "direct-upload" })).toBe(true);
    expect(ok(s.adminProbeSchema, { probe: "other" })).toBe(false);
  });

  it("provider jobs reconcile", () => {
    expect(ok(s.adminProviderJobsReconcileSchema, {})).toBe(true);
    expect(ok(s.adminProviderJobsReconcileSchema, { provider: "NOPE" })).toBe(false);
    expect(ok(s.adminProviderJobsReconcileSchema, { limit: 10, dryRun: true })).toBe(true);
  });

  it("distribution backfill / reorder / resync", () => {
    expect(ok(s.adminDistributionBackfillSchema, { limit: 25, dryRun: false, videoId: "v" })).toBe(true);
    expect(ok(s.adminDistributionBackfillSchema, { limit: "25" })).toBe(false);
    expect(ok(s.adminVideoReorderSchema, { videos: [{ id: "a", sidebarOrder: 1, showInSidebar: true }] })).toBe(true);
    expect(ok(s.adminVideoReorderSchema, { videos: [{ id: "a" }] })).toBe(false);
    expect(ok(s.adminVideoReorderSchema, {})).toBe(false);
    expect(ok(s.adminVideoResyncSchema, { videoId: "v" })).toBe(true);
    expect(ok(s.adminVideoResyncSchema, { videoId: "" })).toBe(false);
  });

  it("video action / plan / upload / route / retry / source", () => {
    expect(ok(s.adminVideoActionSchema, { action: "publish" })).toBe(true);
    expect(ok(s.adminVideoActionSchema, { action: "explode" })).toBe(false);
    expect(ok(s.adminDistributionPlanSchema, { originalId: null, strategy: { x: 1 }, publishAfterReady: true })).toBe(true);
    expect(ok(s.adminOriginalUploadCompleteSchema, { originalId: "o" })).toBe(true);
    expect(ok(s.adminOriginalUploadCompleteSchema, {})).toBe(false);
    expect(ok(s.adminOriginalUploadProvisionSchema, { fileName: "a.mp4", fileSize: 1, contentType: "video/mp4" })).toBe(true);
    expect(ok(s.adminPlaybackRouteSchema, { assetId: "a" })).toBe(true);
    expect(ok(s.adminPlaybackRouteSchema, {})).toBe(false);
    expect(ok(s.adminProviderJobRetrySchema, { force: true })).toBe(true);
    expect(ok(s.adminMuxUploadSchema, { primaryIntent: "yes" })).toBe(false);
    expect(ok(s.adminVideoSourceActionSchema, { action: "set_primary" })).toBe(true);
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
