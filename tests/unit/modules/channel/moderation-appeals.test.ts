import { describe, expect, it, vi } from "vitest";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { createModerationAppeal, listDecisionsForCreator, resolveModerationAppeal } from "@/lib/modules/channel";
import { appealDeadline, checkAppealText, isAppealWindowOpen, isDecisionVisibleToCreator } from "@/lib/modules/channel/domain/moderation-appeal.policy";

vi.mock("@/lib/modules/audit", () => ({ recordAuditEvent: vi.fn(), recordAuditEventSafe: vi.fn() }));
vi.mock("@/lib/modules/notifications", () => ({ sendNotification: vi.fn(async () => ({})) }));
vi.mock("@/lib/modules/email", () => ({ sendModerationDecisionEmail: vi.fn(async () => ({})), sendReporterOutcomeEmail: vi.fn(async () => ({})) }));

const NOW = new Date("2026-10-15T10:00:00Z");
const decision = { id: "d1", channelId: "c1", action: "VIDEO_REMOVED", createdAt: new Date("2026-09-01T00:00:00Z") };

function makePrisma(over: { existingAppeal?: { status: string } | null } = {}) {
  const tx = {
    moderationAppeal: {
      findFirst: vi.fn(async () => over.existingAppeal ?? null),
      create: vi.fn(async () => ({ id: "a1" })),
      updateMany: vi.fn(async () => ({ count: 1 })),
      update: vi.fn(async () => ({})),
    },
    moderationDecision: { create: vi.fn(async () => ({ id: "out1" })) },
    video: { findUnique: vi.fn(async () => ({ id: "v1", moderationStatus: "REMOVED" })), update: vi.fn(async () => ({})) },
    auditLog: { findFirst: vi.fn(async () => ({ metadata: { before: { moderationStatus: "VISIBLE" } } })), create: vi.fn() },
  };
  const prisma = {
    moderationDecision: { findUnique: vi.fn(async () => decision), findMany: vi.fn(async () => []) },
    moderationAppeal: {
      findUnique: vi.fn(async () => ({
        id: "a1", status: "PENDING", userId: "owner",
        decision: { id: "d1", action: "VIDEO_REMOVED", targetType: "VIDEO", targetId: "v1", channelId: "c1" },
      })),
    },
    creator: {
      findUnique: vi.fn(async () => ({ id: "c1", name: "Kanal", userId: "owner", members: [], user: { email: "o@x.pl", language: "pl", isDeleted: false } })),
    },
    user: { findUnique: vi.fn(async () => ({ email: "o@x.pl", language: "pl", isDeleted: false })) },
    $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
  };
  return { prisma, tx };
}

const ctx = (actor: unknown, prisma: unknown) => createAppContext({ actor: actor as never, prisma: prisma as never, now: () => NOW });
const owner = { type: "user" as const, userId: "owner" };
const stranger = { type: "user" as const, userId: "stranger" };
const staff = { type: "admin" as const, userId: "admin1" };

describe("appeal policy", () => {
  it("opens a six-month window and never exposes outcomes or dismissed reports as appealable", () => {
    expect(appealDeadline(new Date("2026-04-15T00:00:00Z")).toISOString()).toBe("2026-10-15T00:00:00.000Z");
    expect(isAppealWindowOpen(new Date("2026-04-14T00:00:00Z"), NOW)).toBe(false);
    expect(isAppealWindowOpen(decision.createdAt, NOW)).toBe(true);
    expect(isDecisionVisibleToCreator("VIDEO_REMOVED")).toBe(true);
    expect(isDecisionVisibleToCreator("APPEAL_UPHELD")).toBe(false);
    expect(isDecisionVisibleToCreator("REPORT_DISMISSED")).toBe(false);
  });

  it("requires a meaningful text", () => {
    expect(checkAppealText("krotko").ok).toBe(false);
    expect(checkAppealText("x".repeat(2001)).ok).toBe(false);
    expect(checkAppealText("  To byla pomylka, film nie lamie zasad.  ")).toMatchObject({ ok: true });
  });
});

describe("creator appeals", () => {
  const text = "To byla pomylka, film nie lamie zadnych zasad platformy.";

  it("lets the owner file one appeal per decision", async () => {
    const { prisma, tx } = makePrisma();
    const res = await createModerationAppeal(ctx(owner, prisma), { decisionId: "d1", text });
    expect(res.ok).toBe(true);
    expect(tx.moderationAppeal.create).toHaveBeenCalledTimes(1);
  });

  it("refuses a second appeal while one exists or after it was resolved", async () => {
    for (const status of ["PENDING", "REJECTED"]) {
      const { prisma, tx } = makePrisma({ existingAppeal: { status } });
      const res = await createModerationAppeal(ctx(owner, prisma), { decisionId: "d1", text });
      expect(res.ok).toBe(false);
      expect(tx.moderationAppeal.create).not.toHaveBeenCalled();
    }
  });

  it("hides the decision from strangers and guests", async () => {
    const { prisma } = makePrisma();
    const res = await createModerationAppeal(ctx(stranger, prisma), { decisionId: "d1", text });
    expect(res.ok).toBe(false);
    if (!res.ok) expect((res.error as { code?: string }).code).toBe("DECISION_NOT_FOUND");
    expect((await listDecisionsForCreator(ctx(stranger, prisma), { channelId: "c1" })).ok).toBe(false);
    expect((await listDecisionsForCreator(ctx({ type: "guest" }, prisma), { channelId: "c1" })).ok).toBe(false);
  });

  it("rejects an expired window", async () => {
    const { prisma } = makePrisma();
    prisma.moderationDecision.findUnique.mockResolvedValueOnce({ ...decision, createdAt: new Date("2026-01-01T00:00:00Z") });
    const res = await createModerationAppeal(ctx(owner, prisma), { decisionId: "d1", text });
    expect(res.ok).toBe(false);
  });
});

describe("staff resolution", () => {
  it("is staff-only and needs a public reason", async () => {
    const { prisma } = makePrisma();
    expect((await resolveModerationAppeal(ctx(owner, prisma), { appealId: "a1", outcome: "UPHELD", reasonPublic: "uzasadnienie" })).ok).toBe(false);
    expect((await resolveModerationAppeal(ctx(staff, prisma), { appealId: "a1", outcome: "UPHELD", reasonPublic: "x" })).ok).toBe(false);
  });

  it("upholding restores the video and writes an outcome decision", async () => {
    const { prisma, tx } = makePrisma();
    const res = await resolveModerationAppeal(ctx(staff, prisma), { appealId: "a1", outcome: "UPHELD", reasonPublic: "Film nie narusza zasad." });
    expect(res.ok).toBe(true);
    expect(tx.video.update).toHaveBeenCalledWith({ where: { id: "v1" }, data: { moderationStatus: "VISIBLE" } });
    expect(tx.moderationDecision.create.mock.calls[0][0].data.action).toBe("APPEAL_UPHELD");
  });

  it("rejecting leaves the content untouched", async () => {
    const { prisma, tx } = makePrisma();
    const res = await resolveModerationAppeal(ctx(staff, prisma), { appealId: "a1", outcome: "REJECTED", reasonPublic: "Decyzja zostaje w mocy." });
    expect(res.ok).toBe(true);
    expect(tx.video.update).not.toHaveBeenCalled();
    expect(tx.moderationDecision.create.mock.calls[0][0].data.action).toBe("APPEAL_REJECTED");
  });

  it("cannot resolve twice", async () => {
    const { prisma, tx } = makePrisma();
    tx.moderationAppeal.updateMany.mockResolvedValueOnce({ count: 0 });
    const res = await resolveModerationAppeal(ctx(staff, prisma), { appealId: "a1", outcome: "REJECTED", reasonPublic: "Decyzja zostaje w mocy." });
    expect(res.ok).toBe(false);
  });
});
