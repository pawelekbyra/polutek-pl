// experiment: premium-pass (docs/experiments/premium-pass.md)
// The SIMULATED checkout (`PREMIUM_PASS_PAYMENTS=demo`, the default). It NEVER takes money: there is no payment
// provider here, no card or BLIK data is accepted (the schema is strict), and the only effect of a "successful
// payment" is one AppSetting row with provider DEMO. In `stripe` mode this use case refuses (WRONG_MODE), so the demo
// can never hand out access that a real payment should have paid for. The real flow is patron-checkout.use-case.ts.
import { z } from "zod";
import type { AppContext } from "@/lib/modules/shared/app-context";
import { PATRON_CURRENCY, patronProduct, premiumPassFor } from "../domain/config";
import { resolvePremiumPayments, toPremiumPaymentsDto } from "../domain/payments-mode";
import {
  applyProduct,
  newDemoRef,
  PASS_METHODS,
  PASS_TERMS_VERSION,
  passStateOf,
  purchaseBlock,
  toPassStatusDto,
  type PassRecord,
  type PassStatusDto,
} from "../domain/pass-state";
import { buildPremiumPassOffer, type PremiumPassOffer } from "../domain/offer";
import { countFunnelEvent, readPass, writePass } from "../infrastructure/pass-store";
import { listPremiumPassVideos, passUserId } from "./pass-access";

export const checkoutDemoInputSchema = z
  .object({
    requestId: z.string().uuid(),
    productId: z.enum(["ACCESS_30D", "ACCESS_LIFETIME"]),
    method: z.enum(PASS_METHODS),
    consents: z.object({ terms: z.boolean(), waiver: z.boolean() }).strict(),
    simulate: z.enum(["success", "declined"]),
  })
  .strict();

export type CheckoutDemoInput = z.infer<typeof checkoutDemoInputSchema>;

export type PassErrorCode =
  | "NOT_VISIBLE"
  | "UNAUTHORIZED"
  | "CONSENT_REQUIRED"
  | "WRONG_MODE"
  | "PAYMENTS_UNAVAILABLE"
  | "PRODUCT_INVALID"
  | "ALREADY_LIFETIME"
  | "MAX_AHEAD"
  | "DEMO_DECLINED"
  | "NO_PASS"
  | "PAYMENT_IN_PROGRESS"
  | "PAYMENT_FAILED"
  | "PAYMENT_NOT_FOUND";

export type PassResult<T> = { ok: true; data: T } | { ok: false; code: PassErrorCode; expiresAt?: string };

export type PremiumPassStatus = { offer: PremiumPassOffer; pass: PassStatusDto };

/** Offer and the viewer's own access (GET /api/user/premium-pass). */
export async function getPremiumPassStatus(ctx: Pick<AppContext, "prisma" | "actor" | "now">): Promise<PassResult<PremiumPassStatus>> {
  const config = premiumPassFor(ctx.actor);
  if (!config) return { ok: false, code: "NOT_VISIBLE" };
  const userId = passUserId(ctx.actor);
  if (!userId) return { ok: false, code: "UNAUTHORIZED" };
  const now = ctx.now();
  const [videos, record] = await Promise.all([listPremiumPassVideos(ctx, config, now), readPass(ctx.prisma, userId)]);
  const state = passStateOf(record, now);
  return {
    ok: true,
    data: {
      offer: buildPremiumPassOffer({
        signedIn: true,
        premiumCount: videos.length,
        expiredAt: state.state === "expired" ? state.record.expiresAt : null,
        payments: toPremiumPaymentsDto(resolvePremiumPayments()),
      }),
      pass: toPassStatusDto(state),
    },
  };
}

/**
 * `success` writes (or extends) the demo access and answers with its receipt; `declined` writes nothing. The same
 * `requestId` twice returns the same receipt (double click, two tabs). Paying while access is active extends it.
 */
export async function checkoutDemoPass(ctx: Pick<AppContext, "prisma" | "actor" | "now">, input: CheckoutDemoInput): Promise<PassResult<PassStatusDto>> {
  const config = premiumPassFor(ctx.actor);
  if (!config) return { ok: false, code: "NOT_VISIBLE" };
  const userId = passUserId(ctx.actor);
  if (!userId) return { ok: false, code: "UNAUTHORIZED" };
  if (resolvePremiumPayments().mode !== "demo") return { ok: false, code: "WRONG_MODE" };
  await countFunnelEvent(ctx, "checkout_submit");
  if (!input.consents.terms || !input.consents.waiver) return { ok: false, code: "CONSENT_REQUIRED" };
  const product = patronProduct(input.productId);
  if (!product) return { ok: false, code: "PRODUCT_INVALID" };

  const now = ctx.now();
  const current = await readPass(ctx.prisma, userId);
  if (current && current.provider === "DEMO" && current.requestId === input.requestId) {
    return { ok: true, data: toPassStatusDto(passStateOf(current, now)) };
  }
  const block = purchaseBlock(current, product, now);
  if (block === "ALREADY_LIFETIME") return { ok: false, code: "ALREADY_LIFETIME" };
  if (block === "MAX_AHEAD") {
    await countFunnelEvent(ctx, "max_ahead");
    return { ok: false, code: "MAX_AHEAD", expiresAt: current?.expiresAt ?? undefined };
  }
  if (input.simulate === "declined") {
    await countFunnelEvent(ctx, "demo_declined");
    return { ok: false, code: "DEMO_DECLINED" };
  }

  const active = current !== null && passStateOf(current, now).state === "active";
  const next = applyProduct(current, product, now);
  const record: PassRecord = {
    v: 3,
    provider: "DEMO",
    ref: newDemoRef(),
    productId: product.id,
    priceMinor: product.priceMinor,
    totalMinor: (active ? current.totalMinor : 0) + product.priceMinor,
    currency: PATRON_CURRENCY,
    method: input.method,
    requestId: input.requestId,
    paymentIds: [],
    lifetime: next.lifetime,
    lifetimePaymentId: null,
    grantedAt: next.grantedAt,
    expiresAt: next.expiresAt,
    consents: { termsVersion: PASS_TERMS_VERSION, waiverAt: now.toISOString() },
  };
  await writePass(ctx.prisma, userId, record);
  await countFunnelEvent(ctx, "demo_success");
  return { ok: true, data: toPassStatusDto({ state: "active", record }) };
}

/** Counts a funnel event the browser reports implicitly (opening the checkout reads the status first). */
export async function notePassFunnelEvent(ctx: Pick<AppContext, "prisma" | "actor" | "now">, event: "offer_view" | "checkout_open"): Promise<void> {
  if (!premiumPassFor(ctx.actor)) return;
  await countFunnelEvent(ctx, event);
}
