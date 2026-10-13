import type { AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";
import { fail, ok, type UseCaseResult } from "@/lib/modules/shared/result";
import { recordAuditEvent } from "@/lib/modules/audit";
import { authorize } from "@/lib/modules/authz";
import { isGateOpen } from "@/lib/platform-gates";
import { creatorShareReversal, payoutAvailableAt, resolveChargeAmount, splitSale, type SaleSplit } from "../domain/split";

/**
 * Paid access to videos (stage 6). Everything here refuses to run while the `sales` platform gate is off, so a
 * server that was not configured for sales behaves exactly like the free-only site (CLAUDE.md 4.24).
 *
 * The payment provider is deliberately not in this module: a checkout adapter creates the provider session and,
 * when the provider confirms the payment, calls `recordOrderPaid`. Refunds call the provider through the
 * `issueRefund` dependency, then book the result here.
 */
const salesClosed = () => new AppError("Płatny dostęp nie jest jeszcze uruchomiony.", 403, "SALES_CLOSED");

/** Commission and hold period are configuration, not code: the owner decides them (docs/architecture). */
export function salesConfig(env: Record<string, string | undefined> = process.env): { feeRateBp: number; holdDays: number } {
  const fee = Number(env.PLATFORM_FEE_BP);
  const hold = Number(env.PLATFORM_PAYOUT_HOLD_DAYS);
  return {
    feeRateBp: Number.isInteger(fee) && fee >= 0 && fee <= 5000 ? fee : 1000,
    holdDays: Number.isInteger(hold) && hold >= 0 && hold <= 90 ? hold : 14,
  };
}

export type SetVideoPriceInput = {
  videoId: string;
  currency: string;
  amountMinor: number;
  payWhatYouWant: boolean;
  minAmountMinor?: number | null;
};

const CURRENCIES = new Set(["PLN", "EUR", "USD", "GBP"]);

/** Makes a video paid (tier PAID + price) or updates its price. Only the channel owner or a manager. */
export async function setVideoPrice(ctx: AppContext, input: SetVideoPriceInput, env?: Record<string, string | undefined>): Promise<UseCaseResult<undefined, AppError>> {
  if (!isGateOpen("sales", env)) return fail(salesClosed());
  const denied = await authorize(ctx, "video.set_price", { videoId: input.videoId });
  if (denied) return fail(denied);
  const currency = input.currency.trim().toUpperCase();
  if (!CURRENCIES.has(currency)) return fail(new AppError("Nieobsługiwana waluta.", 400, "CURRENCY_UNSUPPORTED"));
  const min = input.minAmountMinor ?? null;
  const probe = resolveChargeAmount({ currency, amountMinor: input.amountMinor, payWhatYouWant: true, minAmountMinor: min }, Math.max(input.amountMinor, min ?? 0));
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 100 || !probe.ok) {
    return fail(new AppError("Cena musi wynosić co najmniej 1,00 i być w dopuszczalnym zakresie.", 400, "PRICE_INVALID"));
  }
  if (min !== null && (!Number.isSafeInteger(min) || min < 100 || min > input.amountMinor)) {
    return fail(new AppError("Cena minimalna musi być między 1,00 a ceną sugerowaną.", 400, "PRICE_INVALID"));
  }
  const video = await ctx.prisma.video.findUnique({ where: { id: input.videoId }, select: { id: true, creatorId: true, tier: true } });
  if (!video) return fail(new AppError("Nie znaleziono filmu.", 404, "VIDEO_NOT_FOUND"));
  await ctx.db.writeTransaction(async (tx) => {
    await tx.videoPrice.upsert({
      where: { videoId: video.id },
      create: { videoId: video.id, currency, amountMinor: input.amountMinor, payWhatYouWant: input.payWhatYouWant, minAmountMinor: min },
      update: { currency, amountMinor: input.amountMinor, payWhatYouWant: input.payWhatYouWant, minAmountMinor: min },
    });
    await tx.video.update({ where: { id: video.id }, data: { tier: "PAID" } });
    await recordAuditEvent(ctx, {
      action: "VIDEO_PRICE_SET", targetType: "Video", targetId: video.id, channelId: video.creatorId,
      metadata: { before: { tier: video.tier }, after: { tier: "PAID", currency, amountMinor: input.amountMinor, payWhatYouWant: input.payWhatYouWant, minAmountMinor: min } },
    }, tx);
  });
  return ok(undefined);
}

export type PurchaseQuote = { currency: string; amountMinor: number; payWhatYouWant: boolean; split: SaleSplit };

/** What a buyer would pay and how it splits. Read-only; the checkout adapter calls it before opening a session. */
export async function quoteVideoPurchase(
  ctx: AppContext,
  input: { videoId: string; chosenMinor?: number; vatRateBp: number },
  env?: Record<string, string | undefined>,
): Promise<UseCaseResult<PurchaseQuote, AppError>> {
  if (!isGateOpen("sales", env)) return fail(salesClosed());
  if (ctx.actor.type !== "user") return fail(new AppError("Zaloguj się, aby kupić dostęp.", 401, "UNAUTHENTICATED"));
  const video = await ctx.prisma.video.findUnique({ where: { id: input.videoId }, select: { id: true, tier: true, status: true, price: true } });
  if (!video || video.tier !== "PAID" || !video.price || video.status !== "PUBLISHED") {
    return fail(new AppError("Ten film nie jest dostępny do kupienia.", 404, "NOT_FOR_SALE"));
  }
  const owned = await ctx.prisma.entitlement.findFirst({ where: { userId: ctx.actor.userId, videoId: video.id, revokedAt: null }, select: { id: true } });
  if (owned) return fail(new AppError("Masz już dostęp do tego filmu.", 409, "ALREADY_OWNED"));
  const amount = resolveChargeAmount(video.price, input.chosenMinor);
  if (!amount.ok) return fail(new AppError("Kwota jest poza dopuszczalnym zakresem.", 400, amount.code));
  const { feeRateBp } = salesConfig(env);
  const split = splitSale({ grossMinor: amount.amountMinor, vatRateBp: input.vatRateBp, feeRateBp });
  return ok({ currency: video.price.currency, amountMinor: amount.amountMinor, payWhatYouWant: video.price.payWhatYouWant, split });
}

export type RecordOrderPaidInput = {
  userId: string;
  videoId: string;
  currency: string;
  grossMinor: number;
  vatRateBp: number;
  /** The provider's identifier of the payment; a replayed notification with the same value changes nothing. */
  providerRef: string;
};

/**
 * Books a confirmed payment: order, entitlement and the channel's ledger entry in one transaction.
 * Idempotent on `providerRef`. Runs as the system actor (the provider's webhook), never as a user.
 */
export async function recordOrderPaid(
  ctx: AppContext,
  input: RecordOrderPaidInput,
  env?: Record<string, string | undefined>,
): Promise<UseCaseResult<{ orderId: string; replayed: boolean }, AppError>> {
  if (ctx.actor.type !== "system") return fail(new AppError("Tylko system może zaksięgować płatność.", 403, "FORBIDDEN"));
  if (!isGateOpen("sales", env)) return fail(salesClosed());
  const existing = await ctx.prisma.order.findUnique({ where: { providerRef: input.providerRef }, select: { id: true } });
  if (existing) return ok({ orderId: existing.id, replayed: true });
  const video = await ctx.prisma.video.findUnique({ where: { id: input.videoId }, select: { id: true, creatorId: true, tier: true, price: true } });
  if (!video || video.tier !== "PAID") return fail(new AppError("Ten film nie jest płatny.", 404, "NOT_FOR_SALE"));
  const { feeRateBp, holdDays } = salesConfig(env);
  const split = splitSale({ grossMinor: input.grossMinor, vatRateBp: input.vatRateBp, feeRateBp });
  const now = ctx.now();
  try {
    const orderId = await ctx.db.writeTransaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId: input.userId, videoId: video.id, channelId: video.creatorId, currency: input.currency,
          grossMinor: split.grossMinor, vatMinor: split.vatMinor, netMinor: split.netMinor,
          platformFeeMinor: split.platformFeeMinor, creatorShareMinor: split.creatorShareMinor,
          vatRateBp: split.vatRateBp, feeRateBp: split.feeRateBp,
          status: "PAID", providerRef: input.providerRef, paidAt: now,
        },
        select: { id: true },
      });
      // One entitlement per (user, video): a buyer who was refunded and buys again gets the same row back.
      await tx.entitlement.upsert({
        where: { userId_videoId: { userId: input.userId, videoId: video.id } },
        create: { userId: input.userId, videoId: video.id, orderId: order.id },
        update: { orderId: order.id, revokedAt: null, grantedAt: now },
      });
      await tx.ledgerEntry.create({
        data: {
          channelId: video.creatorId, orderId: order.id, kind: "SALE", currency: input.currency,
          amountMinor: split.creatorShareMinor, availableAt: payoutAvailableAt(now, holdDays),
        },
      });
      await recordAuditEvent(ctx, {
        action: "ORDER_PAID", targetType: "Order", targetId: order.id, channelId: video.creatorId,
        metadata: { videoId: video.id, grossMinor: split.grossMinor, creatorShareMinor: split.creatorShareMinor },
      }, tx);
      return order.id;
    });
    return ok({ orderId, replayed: false });
  } catch (error) {
    // Two deliveries of the same notification racing: the unique providerRef made one of them lose.
    const raced = await ctx.prisma.order.findUnique({ where: { providerRef: input.providerRef }, select: { id: true } });
    if (raced) return ok({ orderId: raced.id, replayed: true });
    throw error;
  }
}

export type IssueRefund = (order: { id: string; providerRef: string | null; currency: string }, amountMinor: number) => Promise<void>;

/**
 * Staff refund (full or partial). The provider is asked first; the books are written only when it accepted, so a
 * provider failure leaves the order untouched. A full refund revokes the entitlement.
 */
export async function refundOrder(
  ctx: AppContext,
  input: { orderId: string; amountMinor: number; reason: string },
  deps: { issueRefund: IssueRefund },
  env?: Record<string, string | undefined>,
): Promise<UseCaseResult<{ status: "PARTIALLY_REFUNDED" | "REFUNDED" }, AppError>> {
  if (!isGateOpen("sales", env)) return fail(salesClosed());
  const denied = await authorize(ctx, "platform.refund");
  if (denied) return fail(denied);
  const reason = input.reason.trim();
  if (reason.length < 5 || reason.length > 500) return fail(new AppError("Podaj powód zwrotu (5-500 znaków).", 400, "REASON_REQUIRED"));
  const order = await ctx.prisma.order.findUnique({ where: { id: input.orderId } });
  if (!order || (order.status !== "PAID" && order.status !== "PARTIALLY_REFUNDED")) {
    return fail(new AppError("Tego zamówienia nie można zwrócić.", 409, "ORDER_NOT_REFUNDABLE"));
  }
  const left = order.grossMinor - order.refundedMinor;
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0 || input.amountMinor > left) {
    return fail(new AppError("Kwota zwrotu przekracza to, co zostało do zwrotu.", 400, "INVALID_REFUND_AMOUNT"));
  }
  try {
    await deps.issueRefund({ id: order.id, providerRef: order.providerRef, currency: order.currency }, input.amountMinor);
  } catch {
    return fail(new AppError("Operator płatności odrzucił zwrot albo nie odpowiada. Sprawdź stan i spróbuj ponownie.", 502, "PAYMENT_PROVIDER_ERROR"));
  }
  const reversal = creatorShareReversal({
    grossMinor: order.grossMinor, creatorShareMinor: order.creatorShareMinor,
    refundedBefore: order.refundedMinor, refundNow: input.amountMinor,
  });
  const refundedTotal = order.refundedMinor + input.amountMinor;
  const status = refundedTotal === order.grossMinor ? "REFUNDED" : "PARTIALLY_REFUNDED";
  const now = ctx.now();
  await ctx.db.writeTransaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: order.id, refundedMinor: order.refundedMinor },
      data: { refundedMinor: refundedTotal, status },
    });
    if (count === 0) throw new AppError("Zamówienie zmieniło się w międzyczasie. Odśwież stronę.", 409, "ORDER_CONFLICT");
    if (reversal > 0) {
      await tx.ledgerEntry.create({
        data: { channelId: order.channelId, orderId: order.id, kind: "REFUND", currency: order.currency, amountMinor: -reversal, availableAt: now, note: reason },
      });
    }
    if (status === "REFUNDED") {
      await tx.entitlement.updateMany({ where: { orderId: order.id, revokedAt: null }, data: { revokedAt: now } });
    }
    await recordAuditEvent(ctx, {
      action: "ORDER_REFUNDED", targetType: "Order", targetId: order.id, channelId: order.channelId,
      metadata: { amountMinor: input.amountMinor, reversalMinor: reversal, status, reason },
    }, tx);
  });
  return ok({ status });
}

/** What the platform owes a channel and how much of it may be paid out now. Read-only. */
export async function getChannelBalance(
  ctx: AppContext,
  channelId: string,
): Promise<UseCaseResult<{ currency: string; owedMinor: number; availableMinor: number }[], AppError>> {
  const denied = await authorize(ctx, "payout.view", { channelId });
  if (denied) return fail(denied);
  const now = ctx.now();
  const rows = await ctx.prisma.ledgerEntry.groupBy({ by: ["currency"], where: { channelId }, _sum: { amountMinor: true } });
  const ready = await ctx.prisma.ledgerEntry.groupBy({ by: ["currency"], where: { channelId, availableAt: { lte: now } }, _sum: { amountMinor: true } });
  const availableBy = new Map(ready.map((r) => [r.currency, r._sum.amountMinor ?? 0]));
  return ok(rows.map((r) => ({ currency: r.currency, owedMinor: r._sum.amountMinor ?? 0, availableMinor: Math.max(0, availableBy.get(r.currency) ?? 0) })));
}
