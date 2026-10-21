// experiment: premium-pass (docs/experiments/premium-pass.md)
// The REAL payment of the patron zone (`PREMIUM_PASS_PAYMENTS=stripe`). It reuses the tip gateway's payment stack
// whole: `createCheckoutIntent` (one Payment row + one PaymentIntent per attempt, amount updated in place), the
// Stripe webhook, the payment-status fast path and the reconciliation cron. This file only decides WHETHER and FOR
// WHAT AMOUNT a patron payment may start. It never grants access: access is written by fulfillPayment() once Stripe
// reports the intent `succeeded` (application/patron-grant.ts), so nothing the browser sends can unlock the zone.
import { z } from "zod";
import { createCheckoutIntent, isPremiumPassPayment } from "@/lib/modules/payments";
import { recordTermsAcceptance } from "@/lib/modules/users";
import { LEGAL_DOCUMENTS_VERSION } from "@/lib/legal/version";
import { logger } from "@/lib/logger";
import type { AppContext } from "@/lib/modules/shared/app-context";
import { PATRON_CURRENCIES, patronPrice, patronProduct, premiumPassFor } from "../domain/config";
import { resolvePremiumPayments } from "../domain/payments-mode";
import { PASS_TERMS_VERSION, purchaseBlock } from "../domain/pass-state";
import { countFunnelEvent, readPass } from "../infrastructure/pass-store";
import { passUserId } from "./pass-access";
import type { PassResult } from "./checkout-demo.use-case";

// The client names a product and a currency, never an amount: the server derives the amount from its own product table.
export const patronIntentInputSchema = z
  .object({ requestId: z.string().uuid(), productId: z.enum(["ACCESS_30D", "ACCESS_LIFETIME"]), currency: z.enum(PATRON_CURRENCIES) })
  .strict();
export type PatronIntentInput = z.infer<typeof patronIntentInputSchema>;

export const patronConsentInputSchema = z
  .object({
    paymentId: z.string().min(1).max(64),
    method: z.string().regex(/^[a-z0-9_]{1,30}$/).optional(),
    consents: z.object({ terms: z.literal(true), waiver: z.literal(true) }).strict(),
  })
  .strict();
export type PatronConsentInput = z.infer<typeof patronConsentInputSchema>;

export type PatronIntentData = {
  paymentId: string;
  clientSecret: string | null;
  paymentMethodTypes: string[];
  /** The attempt was already finished (paid, canceled): the browser starts a new one with a new `requestId`. */
  terminal: boolean;
};

/** Creates or updates (another product chosen) the PaymentIntent of one patron payment attempt. */
export async function startPatronPayment(ctx: AppContext, input: PatronIntentInput): Promise<PassResult<PatronIntentData>> {
  if (!premiumPassFor(ctx.actor)) return { ok: false, code: "NOT_VISIBLE" };
  const userId = passUserId(ctx.actor);
  if (!userId) return { ok: false, code: "UNAUTHORIZED" };

  const payments = resolvePremiumPayments();
  if (payments.mode !== "stripe") return { ok: false, code: "WRONG_MODE" };
  if (!payments.available) {
    logger.warn(`[premium-pass] real payment refused: ${payments.reason}`);
    return { ok: false, code: "PAYMENTS_UNAVAILABLE" };
  }

  const product = patronProduct(input.productId);
  const amountMinor = patronPrice(input.productId, input.currency);
  if (!product || amountMinor === null) return { ok: false, code: "PRODUCT_INVALID" };

  // Refused BEFORE any payment exists: unlimited access already held, or 30 more days would pass the horizon.
  const now = ctx.now();
  const current = await readPass(ctx.prisma, userId);
  const block = purchaseBlock(current, product, now);
  if (block === "ALREADY_LIFETIME") return { ok: false, code: "ALREADY_LIFETIME" };
  if (block === "MAX_AHEAD") {
    await countFunnelEvent(ctx, "max_ahead");
    return { ok: false, code: "MAX_AHEAD", expiresAt: current?.expiresAt ?? undefined };
  }

  const result = await createCheckoutIntent(
    { userId, amountMinor, currency: input.currency, requestId: input.requestId, purpose: "premium_pass", productId: product.id },
    ctx,
  );
  if (!result.ok) return { ok: false, code: result.error.code === "PAYMENT_IN_PROGRESS" ? "PAYMENT_IN_PROGRESS" : "PAYMENT_FAILED" };
  await countFunnelEvent(ctx, "intent_created");
  const { paymentId, clientSecret, paymentMethodTypes, terminal } = result.data;
  return { ok: true, data: { paymentId, clientSecret, paymentMethodTypes: paymentMethodTypes ?? [], terminal: terminal === true } };
}

/**
 * Called right before the browser confirms the payment (step 2, after the two boxes were ticked): stores the consent
 * and the chosen method on the viewer's own, still unpaid patron payment. The Terms acceptance is also recorded on
 * the user like the tip gate does. Access is granted from this record's copy in the grant, never from the call itself.
 */
export async function recordPatronConsent(ctx: AppContext, input: PatronConsentInput): Promise<PassResult<{ recorded: true }>> {
  if (!premiumPassFor(ctx.actor)) return { ok: false, code: "NOT_VISIBLE" };
  const userId = passUserId(ctx.actor);
  if (!userId) return { ok: false, code: "UNAUTHORIZED" };

  const payment = await ctx.prisma.payment.findFirst({ where: { id: input.paymentId, userId, status: "PENDING" }, select: { id: true, metadata: true } });
  if (!payment || !isPremiumPassPayment(payment.metadata)) return { ok: false, code: "PAYMENT_NOT_FOUND" };

  const base = (payment.metadata && typeof payment.metadata === "object" ? payment.metadata : {}) as Record<string, unknown>;
  const waiverAt = ctx.now().toISOString();
  await ctx.prisma.payment.updateMany({
    where: { id: payment.id, userId, status: "PENDING" },
    data: { metadata: { ...base, ...(input.method ? { method: input.method } : {}), consents: { termsVersion: PASS_TERMS_VERSION, waiverAt } } },
  });
  await recordTermsAcceptance(ctx, userId, LEGAL_DOCUMENTS_VERSION).catch((error: unknown) => {
    logger.warn("[premium-pass] could not record Terms acceptance", error instanceof Error ? error.message : String(error));
  });
  return { ok: true, data: { recorded: true } };
}
