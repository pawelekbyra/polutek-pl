import type { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { recordAuditEvent } from "@/lib/modules/audit";
import { minorToPln, netMinor, REVENUE_STATUSES } from "@/lib/modules/admin-overview";
import type { Prisma } from "@prisma/client";
import { toCsv } from "./csv";
import { summarizeRevenue, type PaymentFact, type RevenueSummary } from "./revenue";

const adminOnly = (ctx: AppContext) => {
  if (ctx.actor.type !== "admin") throw new AppError("Only admins can read revenue", 403, "FORBIDDEN");
};

export type Window = { from: Date; to: Date };
const MAX_ROWS = 50_000;

export async function getRevenueOverview(ctx: AppContext, w: Window): Promise<{ current: RevenueSummary; series: { day: string; netPln: number }[]; truncated: boolean }> {
  adminOnly(ctx);
  const rows = await ctx.prisma.payment.findMany({
    where: { createdAt: { gte: w.from, lt: w.to }, status: { in: [...REVENUE_STATUSES, "REFUNDED", "DISPUTED", "CHARGEBACK_LOST"] } },
    select: { amountMinor: true, refundedAmountMinor: true, currency: true, status: true, createdAt: true },
    take: MAX_ROWS + 1,
  });
  const truncated = rows.length > MAX_ROWS;
  const facts: PaymentFact[] = rows.slice(0, MAX_ROWS);
  const byDay = new Map<string, number>();
  for (const r of facts) {
    if (!(REVENUE_STATUSES as readonly string[]).includes(r.status)) continue;
    const pln = minorToPln(netMinor(r), r.currency);
    if (pln === null) continue;
    const day = r.createdAt.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + pln);
  }
  return { current: summarizeRevenue(facts), series: [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, netPln]) => ({ day, netPln })), truncated };
}

export type FunnelStep = { id: string; label: string; count: number };

/** The tip gate as far as the database knows it: attempts (rows), paid, failed, canceled, still open. Views of the gate are telemetry (Analityka). */
export async function getTipFunnel(ctx: AppContext, w: Window): Promise<FunnelStep[]> {
  adminOnly(ctx);
  const groups = await ctx.prisma.payment.groupBy({ by: ["status"], where: { createdAt: { gte: w.from, lt: w.to } }, _count: { _all: true } });
  const n = (...statuses: string[]) => groups.filter((g) => statuses.includes(g.status)).reduce((a, g) => a + g._count._all, 0);
  const attempts = groups.reduce((a, g) => a + g._count._all, 0);
  return [
    { id: "attempts", label: "Rozpoczęte napiwki (utworzone wpłaty)", count: attempts },
    { id: "open", label: "Jeszcze w toku (PENDING)", count: n("PENDING") },
    { id: "failed", label: "Nieudane albo porzucone", count: n("FAILED", "CANCELED") },
    { id: "paid", label: "Opłacone", count: n("SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED", "DISPUTED", "CHARGEBACK_LOST") },
  ];
}

export type DisputeRow = {
  paymentId: string; email: string | null; status: string; amountMinor: number; currency: string; stripeIntentId: string | null;
  disputeId: string | null; reason: string | null; dueBy: string | null; syncedAt: string | null; createdAt: string;
};

function disputeMeta(metadata: unknown): { id?: string; reason?: string; dueBy?: string; syncedAt?: string } {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const d = (metadata as Record<string, unknown>).dispute;
  return d && typeof d === "object" ? (d as Record<string, string>) : {};
}

/** Disputed and lost payments; those with a known evidence deadline first, soonest first. */
export async function listDisputes(ctx: AppContext): Promise<DisputeRow[]> {
  adminOnly(ctx);
  const rows = await ctx.prisma.payment.findMany({
    where: { status: { in: ["DISPUTED", "CHARGEBACK_LOST"] } },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: { id: true, status: true, amountMinor: true, currency: true, stripeIntentId: true, metadata: true, createdAt: true, user: { select: { email: true } } },
  });
  const out = rows.map<DisputeRow>((p) => {
    const d = disputeMeta(p.metadata);
    return { paymentId: p.id, email: p.user?.email ?? null, status: p.status, amountMinor: p.amountMinor, currency: p.currency, stripeIntentId: p.stripeIntentId, disputeId: d.id ?? null, reason: d.reason ?? null, dueBy: d.dueBy ?? null, syncedAt: d.syncedAt ?? null, createdAt: p.createdAt.toISOString() };
  });
  return out.sort((a, b) => (a.status === b.status ? 0 : a.status === "DISPUTED" ? -1 : 1) || (a.dueBy ?? "9").localeCompare(b.dueBy ?? "9"));
}

export type RefundRow = { paymentId: string; email: string | null; refundedMinor: number; currency: string; at: string | null; reason: string | null; byAdminId: string | null };

export async function listRecentRefunds(ctx: AppContext, take = 10): Promise<RefundRow[]> {
  adminOnly(ctx);
  const rows = await ctx.prisma.payment.findMany({
    where: { refundedAmountMinor: { gt: 0 } },
    orderBy: { updatedAt: "desc" },
    take,
    select: { id: true, refundedAmountMinor: true, currency: true, refundedAt: true, refundReason: true, refundedById: true, updatedAt: true, user: { select: { email: true } } },
  });
  return rows.map((p) => ({ paymentId: p.id, email: p.user?.email ?? null, refundedMinor: p.refundedAmountMinor, currency: p.currency, at: (p.refundedAt ?? p.updatedAt).toISOString(), reason: p.refundReason, byAdminId: p.refundedById }));
}

export type StripeEventRow = { id: string; type: string; status: string; error: string | null; createdAt: string; processedAt: string | null; lagMs: number | null };
export type StripeEventsView = { events: StripeEventRow[]; failed: number; stuck: number; lastAt: string | null };

export async function getStripeEvents(ctx: AppContext, now: Date = ctx.now()): Promise<StripeEventsView> {
  adminOnly(ctx);
  const week = new Date(now.getTime() - 7 * 86_400_000);
  const stuckBefore = new Date(now.getTime() - 15 * 60_000);
  const [events, failed, stuck] = await Promise.all([
    ctx.prisma.stripeEvent.findMany({ orderBy: { createdAt: "desc" }, take: 40, select: { id: true, type: true, status: true, error: true, createdAt: true, processedAt: true } }),
    ctx.prisma.stripeEvent.count({ where: { status: "FAILED", createdAt: { gte: week } } }),
    ctx.prisma.stripeEvent.count({ where: { status: "PROCESSING", createdAt: { lt: stuckBefore } } }),
  ]);
  return {
    events: events.map((e) => ({ id: e.id, type: e.type, status: e.status, error: e.error ? e.error.slice(0, 200) : null, createdAt: e.createdAt.toISOString(), processedAt: e.processedAt?.toISOString() ?? null, lagMs: e.processedAt ? e.processedAt.getTime() - e.createdAt.getTime() : null })),
    failed,
    stuck,
    lastAt: events[0]?.createdAt.toISOString() ?? null,
  };
}

export type ReconciliationView = {
  stalePending: { id: string; createdAt: string; amountMinor: number; currency: string; hasIntent: boolean }[];
  totals: { currency: string; fromPayments: number; fromTotals: number; diff: number }[];
};

/**
 * Local consistency (no call to Stripe): payments PENDING for over 15 minutes, and per currency the sum of
 * received money (net of refunds, without disputed/lost) against the per-user running totals the supporter
 * logic uses. A non-zero difference means a webhook or refund path missed an update.
 */
export async function getReconciliation(ctx: AppContext, now: Date = ctx.now()): Promise<ReconciliationView> {
  adminOnly(ctx);
  const [pending, paid, totals] = await Promise.all([
    ctx.prisma.payment.findMany({ where: { status: "PENDING", createdAt: { lt: new Date(now.getTime() - 15 * 60_000) } }, orderBy: { createdAt: "asc" }, take: 50, select: { id: true, createdAt: true, amountMinor: true, currency: true, stripeIntentId: true } }),
    ctx.prisma.payment.groupBy({ by: ["currency"], where: { status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED"] } }, _sum: { amountMinor: true, refundedAmountMinor: true } }),
    ctx.prisma.userPaymentTotal.groupBy({ by: ["currency"], _sum: { amountMinor: true } }),
  ]);
  const currencies = new Set([...paid.map((p) => p.currency), ...totals.map((t) => t.currency)]);
  return {
    stalePending: pending.map((p) => ({ id: p.id, createdAt: p.createdAt.toISOString(), amountMinor: p.amountMinor, currency: p.currency, hasIntent: !!p.stripeIntentId })),
    totals: [...currencies].sort().map((currency) => {
      const p = paid.find((x) => x.currency === currency);
      const fromPayments = (p?._sum.amountMinor ?? 0) - (p?._sum.refundedAmountMinor ?? 0);
      const fromTotals = totals.find((t) => t.currency === currency)?._sum.amountMinor ?? 0;
      return { currency, fromPayments, fromTotals, diff: fromTotals - fromPayments };
    }),
  };
}

export type PaymentsExportFilters = { status?: string; currency?: string; q?: string; from?: Date; to?: Date };

export function paymentsWhere(f: PaymentsExportFilters): Prisma.PaymentWhereInput {
  return {
    ...(f.status ? { status: f.status as never } : {}),
    ...(f.currency ? { currency: f.currency } : {}),
    ...(f.from || f.to ? { createdAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}) } } : {}),
    ...(f.q ? { OR: [{ id: { contains: f.q, mode: "insensitive" } }, { stripeIntentId: { contains: f.q, mode: "insensitive" } }, { user: { email: { contains: f.q, mode: "insensitive" } } }] } : {}),
  };
}

/** CSV of the filtered payments (personal data: e-mail). The caller must have passed step-up; the export is audited. */
export async function exportPaymentsCsv(ctx: AppContext, f: PaymentsExportFilters): Promise<{ csv: string; rows: number; truncated: boolean }> {
  adminOnly(ctx);
  const rows = await ctx.prisma.payment.findMany({
    where: paymentsWhere(f),
    orderBy: { createdAt: "desc" },
    take: 20_001,
    select: { id: true, createdAt: true, amountMinor: true, refundedAmountMinor: true, currency: true, status: true, stripeIntentId: true, refundReason: true, user: { select: { email: true } } },
  });
  const truncated = rows.length > 20_000;
  const data = rows.slice(0, 20_000);
  const csv = toCsv(
    ["id", "utworzono", "e-mail", "kwota", "zwrócono", "netto", "waluta", "status", "stripe_intent", "powód_zwrotu"],
    data.map((r) => [r.id, r.createdAt, r.user?.email ?? "", (r.amountMinor / 100).toFixed(2), (r.refundedAmountMinor / 100).toFixed(2), (Math.max(0, r.amountMinor - r.refundedAmountMinor) / 100).toFixed(2), r.currency, r.status, r.stripeIntentId ?? "", r.refundReason ?? ""]),
  );
  await recordAuditEvent(ctx, { action: "PAYMENTS_EXPORTED", targetType: "Payment", metadata: { rows: data.length, truncated, filters: { status: f.status ?? null, currency: f.currency ?? null, q: f.q ? "(set)" : null, from: f.from?.toISOString() ?? null, to: f.to?.toISOString() ?? null } } });
  return { csv, rows: data.length, truncated };
}

export type PaymentBrief = { id: string; status: string; amountMinor: number; refundedAmountMinor: number; currency: string; email: string | null };

/** The facts the refund action re-checks on the server (the dialog's numbers are never trusted). */
export async function getPaymentBrief(ctx: AppContext, id: string): Promise<PaymentBrief | null> {
  adminOnly(ctx);
  const p = await ctx.prisma.payment.findUnique({ where: { id }, select: { id: true, status: true, amountMinor: true, refundedAmountMinor: true, currency: true, user: { select: { email: true } } } });
  return p ? { id: p.id, status: p.status, amountMinor: p.amountMinor, refundedAmountMinor: p.refundedAmountMinor, currency: p.currency, email: p.user?.email ?? null } : null;
}
