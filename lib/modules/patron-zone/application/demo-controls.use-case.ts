// patron zone (docs/architecture/patron-zone.md)
import { z } from "zod";
import type { AppContext } from "@/lib/modules/shared/app-context";
import { premiumPassFor } from "../domain/config";
import { resolvePremiumPayments } from "../domain/payments-mode";
import { passStateOf, toPassStatusDto, type PassRecord, type PassStatusDto } from "../domain/pass-state";
import { deletePass, readPass, writePass } from "../infrastructure/pass-store";
import { passUserId } from "./pass-access";
import type { PassResult } from "./checkout-demo.use-case";

export const demoControlInputSchema = z.object({ action: z.enum(["expire", "reset"]) }).strict();

/**
 * The demo panel: lets any signed-in viewer who sees the patron zone expire or delete THEIR OWN access, to look at every
 * state without waiting. There is no way to touch another account's row. Only in demo mode (PREMIUM_PASS_PAYMENTS=demo):
 * in `stripe` mode (test or live keys) a grant is the proof of a payment and no panel may remove it.
 */
export async function runPassDemoControl(ctx: Pick<AppContext, "prisma" | "actor" | "now">, input: z.infer<typeof demoControlInputSchema>): Promise<PassResult<PassStatusDto>> {
  const config = premiumPassFor(ctx.actor);
  if (!config) return { ok: false, code: "NOT_VISIBLE" };
  const userId = passUserId(ctx.actor);
  if (!userId) return { ok: false, code: "UNAUTHORIZED" };
  const payments = resolvePremiumPayments();
  if (payments.mode !== "demo") return { ok: false, code: "WRONG_MODE" };
  const now = ctx.now();
  if (input.action === "reset") {
    await deletePass(ctx.prisma, userId);
    return { ok: true, data: { state: "none" } };
  }
  const record = await readPass(ctx.prisma, userId);
  if (!record) return { ok: false, code: "NO_PASS" };
  // "expire" ends everything, a lifetime marker included (the panel is for looking at the expired state)
  const expired: PassRecord = { ...record, lifetime: false, lifetimePaymentId: null, expiresAt: new Date(now.getTime() - 1000).toISOString() };
  await writePass(ctx.prisma, userId, expired);
  return { ok: true, data: toPassStatusDto(passStateOf(expired, now)) };
}
