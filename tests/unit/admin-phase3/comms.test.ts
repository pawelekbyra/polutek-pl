import { describe, expect, it, vi } from "vitest";
import { getDeliverability, getEmailTemplateDefault, getSuppressions, previewEmailTemplate, resendLimits } from "@/lib/modules/email";
import { hasChanges, lineDiff } from "@admin/lib/text-diff";
import type { AppContext } from "@/lib/modules/shared/app-context";

const admin = { type: "admin", userId: "a1" } as const;
const mk = (prisma: object, actor: AppContext["actor"] = admin) => ({ actor, prisma, now: () => new Date("2026-10-05T12:00:00Z") }) as unknown as AppContext;

describe("previewEmailTemplate", () => {
  it("fills sample values, wraps the document and strips scripts like a real save", () => {
    const p = previewEmailTemplate({ slug: "welcome-email", language: "pl", subject: "Cześć {{firstName}}", html: '<p>Hej {{firstName}} <script>alert(1)</script></p><a href="javascript:x">x</a>' });
    expect(p.subject).toBe("Cześć Jan");
    expect(p.html).toContain("<!DOCTYPE html>");
    expect(p.html).toContain("Hej Jan");
    expect(p.html).not.toContain("<script");
    expect(p.html).not.toContain("javascript:");
  });

  it("uses the English version when both English fields exist, else falls back to Polish", () => {
    const base = { slug: "welcome-email", subject: "Cześć", html: "<p>PL</p>" };
    expect(previewEmailTemplate({ ...base, language: "en", subjectEn: "Hi {{firstName}}", htmlEn: "<p>EN</p>" })).toMatchObject({ subject: "Hi John" });
    expect(previewEmailTemplate({ ...base, language: "en", subjectEn: "", htmlEn: "" }).subject).toBe("Cześć");
  });

  it("reports unknown and missing required variables, and escapes values", () => {
    const p = previewEmailTemplate({ slug: "verify-email", language: "pl", subject: "x", html: "<p>{{nope}}</p>" });
    expect(p.problems.unknown).toEqual(["nope"]);
    expect(p.problems.missingRequired).toEqual(["actionUrl"]);
  });
});

describe("template defaults", () => {
  it("returns the shipped text for a system slug and null for a custom one", () => {
    expect(getEmailTemplateDefault("verify-email")).toMatchObject({ isSystem: true, isCustomized: false, subject: expect.any(String) });
    expect(getEmailTemplateDefault("my-own-template")).toBeNull();
  });
});

describe("lineDiff", () => {
  it("marks added and removed lines and nothing for identical text", () => {
    expect(hasChanges(lineDiff("a\nb", "a\nb"))).toBe(false);
    expect(lineDiff("a\nb\nc", "a\nx\nc").filter((l) => l.kind !== "same")).toEqual([{ kind: "del", text: "b" }, { kind: "add", text: "x" }]);
    expect(lineDiff("", "new").some((l) => l.kind === "add" && l.text === "new")).toBe(true);
    expect(lineDiff("a\r\nb", "a\nb").every((l) => l.kind === "same")).toBe(true);
  });
});

describe("deliverability and suppressions", () => {
  it("computes rates and the daily/monthly counters, and refuses non-admins", async () => {
    const prisma = {
      emailEvent: {
        groupBy: vi.fn(async () => [{ type: "email.sent", _count: { _all: 200 } }, { type: "email.delivered", _count: { _all: 190 } }, { type: "email.bounced", _count: { _all: 6 } }, { type: "email.complained", _count: { _all: 1 } }]),
        count: vi.fn(async ({ where }: { where: { createdAt: { gte: Date } } }) => (where.createdAt.gte.getUTCDate() === 5 ? 12 : 140)),
        findFirst: vi.fn(async () => ({ createdAt: new Date("2026-10-05T11:00:00Z") })),
      },
      broadcastEmailRecipient: { groupBy: vi.fn(async () => [{ status: "SENT", _count: { _all: 5 } }, { status: "DELIVERED", _count: { _all: 3 } }, { status: "PENDING", _count: { _all: 2 } }, { status: "BOUNCED", _count: { _all: 1 } }]) },
    };
    const d = await getDeliverability(mk(prisma));
    expect(d).toMatchObject({ sent: 200, bounced: 6, bounceRate: 3, complaintRate: 0.5, sentToday: 12, sentMonth: 140, broadcastRecipients: { sent: 8, pending: 2, failed: 1 } });
    await expect(getDeliverability(mk(prisma, { type: "user", userId: "u" }))).rejects.toThrow("Only admins");
    expect(resendLimits({ RESEND_DAILY_LIMIT: "1000" })).toMatchObject({ perDay: 1000, perMonth: 3000 });
    expect(resendLimits({ RESEND_DAILY_LIMIT: "abc" }).perDay).toBe(100);
  });

  it("lists blocks and unsubscribes with counts", async () => {
    const prisma = {
      emailSuppression: { findMany: vi.fn(async () => [{ email: "b@x", reason: "BOUNCE", lastSeenAt: new Date("2026-10-04T10:00:00Z") }]), count: vi.fn(async () => 1) },
      emailPreference: { findMany: vi.fn(async () => [{ email: "u@x", unsubscribedAt: new Date("2026-10-03T10:00:00Z") }]), count: vi.fn(async ({ where }: { where: object }) => ("marketingEmails" in where ? 31 : 4)) },
    };
    const s = await getSuppressions(mk(prisma));
    expect(s.counts).toEqual({ blocked: 1, unsubscribed: 4, consenting: 31 });
    expect(s.blocked[0].email).toBe("b@x");
  });
});

describe("sendBroadcastTest with a panel recipient", () => {
  it("never looks up a site user and carries the generic unsubscribe page (no token for a panel id)", async () => {
    vi.resetModules();
    const send = vi.fn(async () => ({ data: { id: "e1" }, error: null }));
    vi.doMock("resend", () => ({ Resend: class { emails = { send }; } }));
    vi.doMock("@/lib/modules/audit", () => ({ recordAuditEvent: vi.fn(async () => undefined) }));
    process.env.RESEND_API_KEY = "test_key";
    process.env.NEXT_PUBLIC_APP_URL = "https://www.pawelperfect.com";
    const { sendBroadcastTest } = await import("@/lib/modules/email");
    const findUnique = vi.fn();
    const ctx = { actor: admin, prisma: { user: { findUnique } } } as unknown as AppContext;
    const r = await sendBroadcastTest(ctx, { subjectPl: "T", htmlPl: "<p>x</p>", language: "pl", recipient: { email: "owner@example.com", name: "Właściciel" } });
    expect(r.ok).toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
    const sent = send.mock.calls[0] as unknown as [{ to: string[]; subject: string; headers: Record<string, string> }];
    expect(sent[0].to).toEqual(["owner@example.com"]);
    expect(sent[0].subject).toBe("[TEST] T");
    expect(sent[0].headers["List-Unsubscribe"]).toContain("/unsubscribe");
    expect(sent[0].headers["List-Unsubscribe"]).not.toContain("token=");
    vi.doUnmock("resend");
    vi.doUnmock("@/lib/modules/audit");
  });
});
