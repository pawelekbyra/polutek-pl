import { describe, expect, it, vi } from "vitest";
import { csvCell, exportPaymentsCsv, getReconciliation, getStripeEvents, getTipFunnel, listDisputes, parseMoneyToMinor, stripeDashboardUrl, summarizeRevenue, toCsv } from "@/lib/modules/admin-revenue";
import type { AppContext } from "@/lib/modules/shared/app-context";

const audit = vi.hoisted(() => ({ recordAuditEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/modules/audit", () => audit);

const d = new Date("2026-10-03T10:00:00Z");

describe("CSV is injection-safe", () => {
  it("prefixes formula starters with an apostrophe and quotes separators", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe(`"'=HYPERLINK(""http://x"")"`);
    for (const bad of ["+1", "-1", "@SUM(A1)", "\tcmd", "\rcmd"]) expect(csvCell(bad).replace(/^"/, "").startsWith("'")).toBe(true);
    expect(csvCell("zwykły tekst")).toBe("zwykły tekst");
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell(null)).toBe("");
    expect(csvCell(d)).toBe("2026-10-03T10:00:00.000Z");
  });

  it("writes a BOM, CRLF and one row per record", () => {
    const csv = toCsv(["a", "b"], [["=x", 2], ["y", 3]]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv.split("\r\n")).toEqual(["﻿a,b", "'=x,2", "y,3", ""]);
  });
});

describe("revenue definition and money math", () => {
  const rows = [
    { amountMinor: 2000, refundedAmountMinor: 0, currency: "PLN", status: "SUCCEEDED", createdAt: d },
    { amountMinor: 5000, refundedAmountMinor: 1250, currency: "PLN", status: "PARTIALLY_REFUNDED", createdAt: d },
    { amountMinor: 1000, refundedAmountMinor: 1000, currency: "PLN", status: "REFUNDED", createdAt: d },
    { amountMinor: 3000, refundedAmountMinor: 0, currency: "PLN", status: "DISPUTED", createdAt: d },
    { amountMinor: 900, refundedAmountMinor: 0, currency: "PLN", status: "CHARGEBACK_LOST", createdAt: d },
    { amountMinor: 700, refundedAmountMinor: 0, currency: "PLN", status: "PENDING", createdAt: d },
    { amountMinor: 1000, refundedAmountMinor: 0, currency: "XYZ", status: "SUCCEEDED", createdAt: d },
  ];
  it("counts only SUCCEEDED and PARTIALLY_REFUNDED, net of refunds, and lists what it cannot convert", () => {
    const s = summarizeRevenue(rows);
    const pln = s.byCurrency.find((c) => c.currency === "PLN")!;
    expect(pln).toMatchObject({ grossMinor: 7000, refundedMinor: 1250, netMinor: 5750, count: 2 });
    expect(s.netPln).toBe(57.5);
    expect(s.unconvertedCurrencies).toEqual(["XYZ"]);
    expect(s.disputed).toBe(1);
    expect(s.chargebackLost).toBe(1);
    expect(s.refundCount).toBe(2);
    expect(s.medianPln).toBe(scalarMedian([20, 37.5]));
  });
  it("parses złoty strings into minor units with no float drift", () => {
    expect(parseMoneyToMinor("12,50")).toBe(1250);
    expect(parseMoneyToMinor(" 0.29 ")).toBe(29);
    expect(parseMoneyToMinor("19.99")).toBe(1999);
    expect(parseMoneyToMinor("1 000")).toBe(100000);
    for (const bad of ["", "0", "-5", "1,234", "abc", "1e3", "12,"]) expect(parseMoneyToMinor(bad)).toBeNull();
  });
  it("builds Stripe dashboard links only for real ids and respects test mode", () => {
    expect(stripeDashboardUrl("pi_3Abc123XYZ", true)).toBe("https://dashboard.stripe.com/payments/pi_3Abc123XYZ");
    expect(stripeDashboardUrl("pi_3Abc123XYZ", false)).toBe("https://dashboard.stripe.com/test/payments/pi_3Abc123XYZ");
    expect(stripeDashboardUrl("dp_1Abcdef", true)).toContain("/disputes/");
    expect(stripeDashboardUrl("pi_../../evil", true)).toBeNull();
    expect(stripeDashboardUrl("javascript:alert(1)", true)).toBeNull();
    expect(stripeDashboardUrl(null, true)).toBeNull();
  });
});
function scalarMedian(v: number[]) {
  return (v[0] + v[1]) / 2;
}

const admin = { type: "admin", userId: "a1" } as const;
const mk = (prisma: object, actor: AppContext["actor"] = admin) => ({ actor, prisma, now: () => new Date("2026-10-05T12:00:00Z"), db: { read: prisma, writeTransaction: async (fn: (t: unknown) => unknown) => fn(prisma) } }) as unknown as AppContext;

describe("read models", () => {
  it("refuse everyone but an admin", async () => {
    await expect(listDisputes(mk({}, { type: "user", userId: "u" }))).rejects.toThrow("Only admins");
  });

  it("lists disputes with the stored deadline first and open before lost", async () => {
    const prisma = { payment: { findMany: vi.fn(async () => [
      { id: "p1", status: "CHARGEBACK_LOST", amountMinor: 900, currency: "PLN", stripeIntentId: "pi_1", metadata: null, createdAt: d, user: { email: "a@x" } },
      { id: "p2", status: "DISPUTED", amountMinor: 5000, currency: "PLN", stripeIntentId: "pi_2", metadata: { dispute: { id: "dp_9", reason: "fraudulent", dueBy: "2026-10-08T21:59:00.000Z" } }, createdAt: d, user: { email: "b@x" } },
      { id: "p3", status: "DISPUTED", amountMinor: 100, currency: "PLN", stripeIntentId: "pi_3", metadata: { dispute: { dueBy: "2026-10-06T21:59:00.000Z" } }, createdAt: d, user: null },
    ]) } };
    const res = await listDisputes(mk(prisma));
    expect(res.map((r) => r.paymentId)).toEqual(["p3", "p2", "p1"]);
    expect(res[1]).toMatchObject({ disputeId: "dp_9", reason: "fraudulent" });
  });

  it("funnel counts every status bucket", async () => {
    const prisma = { payment: { groupBy: vi.fn(async () => [{ status: "SUCCEEDED", _count: { _all: 3 } }, { status: "DISPUTED", _count: { _all: 1 } }, { status: "PENDING", _count: { _all: 2 } }, { status: "FAILED", _count: { _all: 4 } }]) } };
    const f = await getTipFunnel(mk(prisma), { from: d, to: d });
    expect(Object.fromEntries(f.map((s) => [s.id, s.count]))).toEqual({ attempts: 10, open: 2, failed: 4, paid: 4 });
  });

  it("stripe events view computes lag and trims long errors", async () => {
    const prisma = { stripeEvent: {
      findMany: vi.fn(async () => [{ id: "evt_1", type: "charge.refunded", status: "FAILED", error: "x".repeat(500), createdAt: d, processedAt: new Date(d.getTime() + 1400) }]),
      count: vi.fn(async () => 2),
    } };
    const v = await getStripeEvents(mk(prisma));
    expect(v.events[0].lagMs).toBe(1400);
    expect(v.events[0].error).toHaveLength(200);
    expect(v).toMatchObject({ failed: 2, stuck: 2 });
  });

  it("reconciliation shows a difference between payments and per-user totals", async () => {
    const prisma = { payment: {
      findMany: vi.fn(async () => [{ id: "p", createdAt: d, amountMinor: 1000, currency: "PLN", stripeIntentId: null }]),
      groupBy: vi.fn(async () => [{ currency: "PLN", _sum: { amountMinor: 9000, refundedAmountMinor: 1000 } }]),
    }, userPaymentTotal: { groupBy: vi.fn(async () => [{ currency: "PLN", _sum: { amountMinor: 7500 } }]) } };
    const r = await getReconciliation(mk(prisma));
    expect(r.totals).toEqual([{ currency: "PLN", fromPayments: 8000, fromTotals: 7500, diff: -500 }]);
    expect(r.stalePending[0].hasIntent).toBe(false);
  });
});

describe("exportPaymentsCsv", () => {
  it("neutralizes formulas in e-mails and refund reasons, and writes one audit entry without the search text", async () => {
    const prisma = { payment: { findMany: vi.fn(async () => [{ id: "p1", createdAt: d, amountMinor: 1250, refundedAmountMinor: 250, currency: "PLN", status: "PARTIALLY_REFUNDED", stripeIntentId: "pi_1", refundReason: "=cmd|' /C calc'!A0", user: { email: "+evil@x.pl" } }]) } };
    const ctx = mk(prisma);
    const r = await exportPaymentsCsv(ctx, { q: "secret@person.pl", status: "SUCCEEDED" });
    expect(r.rows).toBe(1);
    expect(r.csv).toContain("'+evil@x.pl");
    expect(r.csv).toContain("'=cmd");
    expect(r.csv).toContain("12.50,2.50,10.00,PLN");
    const call = audit.recordAuditEvent.mock.calls.at(-1) as unknown as [unknown, { action: string; metadata: { filters: { q: string } } }];
    expect(call[1].action).toBe("PAYMENTS_EXPORTED");
    expect(call[1].metadata.filters.q).toBe("(set)");
    expect(JSON.stringify(call[1])).not.toContain("secret@person.pl");
  });
});
