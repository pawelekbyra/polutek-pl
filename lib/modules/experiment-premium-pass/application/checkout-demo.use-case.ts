// experiment: premium-pass (docs/experiments/premium-pass.md)
// The simulated checkout. It NEVER takes money: there is no payment provider here, no card or BLIK data is accepted
// (the schema is strict), and the only effect of a "successful payment" is one AppSetting row with provider DEMO.
// tests/unit/experiments/premium-pass-no-money.test.ts guards that no payment code is ever imported into the experiment.
import { z } from "zod";
import type { AppContext } from "@/lib/modules/shared/app-context";
import { PASS_CURRENCY, passProduct, premiumPassFor, PASS_PRODUCTS, type PassProductId } from "../domain/config";
import {
  addDays,
  newDemoRef,
  PASS_METHODS,
  PASS_TERMS_VERSION,
  passStateOf,
  toPassStatusDto,
  type DemoPassRecord,
  type PassStatusDto,
} from "../domain/pass-state";
import { buildPremiumPassOffer, type PremiumPassOffer } from "../domain/offer";
import { countFunnelEvent, readDemoPass, writeDemoPass } from "../infrastructure/pass-store";
import { listPremiumPassVideos, passUserId } from "./pass-access";

const productIds = PASS_PRODUCTS.map((p) => p.id) as [PassProductId, ...PassProductId[]];

export const checkoutDemoInputSchema = z
  .object({
    requestId: z.string().uuid(),
    product: z.enum(productIds),
    method: z.enum(PASS_METHODS),
    consents: z.object({ terms: z.boolean(), waiver: z.boolean() }).strict(),
    simulate: z.enum(["success", "declined"]),
  })
  .strict();

export type CheckoutDemoInput = z.infer<typeof checkoutDemoInputSchema>;

export type PassErrorCode = "NOT_VISIBLE" | "UNAUTHORIZED" | "CONSENT_REQUIRED" | "PASS_ALREADY_ACTIVE" | "DEMO_DECLINED" | "NO_PASS";

export type PassResult<T> = { ok: true; data: T } | { ok: false; code: PassErrorCode; expiresAt?: string };

export type PremiumPassStatus = { offer: PremiumPassOffer; pass: PassStatusDto };

/** Offer and the viewer's own pass (GET /api/user/premium-pass). */
export async function getPremiumPassStatus(ctx: Pick<AppContext, "prisma" | "actor" | "now">): Promise<PassResult<PremiumPassStatus>> {
  const config = premiumPassFor(ctx.actor);
  if (!config) return { ok: false, code: "NOT_VISIBLE" };
  const userId = passUserId(ctx.actor);
  if (!userId) return { ok: false, code: "UNAUTHORIZED" };
  const now = ctx.now();
  const [videos, record] = await Promise.all([listPremiumPassVideos(ctx, config, now), readDemoPass(ctx, userId)]);
  const state = passStateOf(record, now);
  return {
    ok: true,
    data: {
      offer: buildPremiumPassOffer({ signedIn: true, premiumCount: videos.length, expiredAt: state.state === "expired" ? state.record.expiresAt : null }),
      pass: toPassStatusDto(state),
    },
  };
}

/**
 * `success` writes the demo pass and answers with its receipt; `declined` writes nothing. The same `requestId` twice
 * returns the same receipt (double click, two tabs); another purchase while a pass is active is refused.
 */
export async function checkoutDemoPass(ctx: Pick<AppContext, "prisma" | "actor" | "now">, input: CheckoutDemoInput): Promise<PassResult<PassStatusDto>> {
  const config = premiumPassFor(ctx.actor);
  if (!config) return { ok: false, code: "NOT_VISIBLE" };
  const userId = passUserId(ctx.actor);
  if (!userId) return { ok: false, code: "UNAUTHORIZED" };
  await countFunnelEvent(ctx, "checkout_submit");
  if (!input.consents.terms || !input.consents.waiver) return { ok: false, code: "CONSENT_REQUIRED" };

  const now = ctx.now();
  const existing = passStateOf(await readDemoPass(ctx, userId), now);
  if (existing.state !== "none" && existing.record.requestId === input.requestId) {
    return { ok: true, data: toPassStatusDto(existing) };
  }
  if (existing.state === "active") {
    await countFunnelEvent(ctx, "already_active");
    return { ok: false, code: "PASS_ALREADY_ACTIVE", expiresAt: existing.record.expiresAt };
  }
  if (input.simulate === "declined") {
    await countFunnelEvent(ctx, "demo_declined");
    return { ok: false, code: "DEMO_DECLINED" };
  }

  const product = passProduct(input.product)!;
  const record: DemoPassRecord = {
    v: 1,
    product: product.id,
    provider: "DEMO",
    ref: newDemoRef(),
    priceMinor: product.priceMinor,
    currency: PASS_CURRENCY,
    method: input.method,
    requestId: input.requestId,
    grantedAt: now.toISOString(),
    expiresAt: addDays(now, product.days).toISOString(),
    consents: { termsVersion: PASS_TERMS_VERSION, waiverAt: now.toISOString() },
  };
  await writeDemoPass(ctx, userId, record);
  await countFunnelEvent(ctx, "demo_success");
  return { ok: true, data: toPassStatusDto({ state: "active", record }) };
}

/** Counts a funnel event the browser reports implicitly (opening the checkout reads the status first). */
export async function notePassFunnelEvent(ctx: Pick<AppContext, "prisma" | "actor" | "now">, event: "offer_view" | "checkout_open"): Promise<void> {
  if (!premiumPassFor(ctx.actor)) return;
  await countFunnelEvent(ctx, event);
}
