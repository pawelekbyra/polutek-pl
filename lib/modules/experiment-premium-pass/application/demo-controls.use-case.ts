// experiment: premium-pass (docs/experiments/premium-pass.md)
import { z } from "zod";
import type { AppContext } from "@/lib/modules/shared/app-context";
import { premiumPassFor } from "../domain/config";
import { passStateOf, toPassStatusDto, type DemoPassRecord, type PassStatusDto } from "../domain/pass-state";
import { deleteDemoPass, readDemoPass, writeDemoPass } from "../infrastructure/pass-store";
import { passUserId } from "./pass-access";
import type { PassResult } from "./checkout-demo.use-case";

export const demoControlInputSchema = z.object({ action: z.enum(["expire", "reset"]) }).strict();

/**
 * The demo panel: lets any signed-in viewer who sees the experiment expire or delete THEIR OWN demo pass, to look at
 * every state without waiting. There is no way to touch another account's row.
 */
export async function runPassDemoControl(ctx: Pick<AppContext, "prisma" | "actor" | "now">, input: z.infer<typeof demoControlInputSchema>): Promise<PassResult<PassStatusDto>> {
  const config = premiumPassFor(ctx.actor);
  if (!config) return { ok: false, code: "NOT_VISIBLE" };
  const userId = passUserId(ctx.actor);
  if (!userId) return { ok: false, code: "UNAUTHORIZED" };
  const now = ctx.now();
  if (input.action === "reset") {
    await deleteDemoPass(ctx, userId);
    return { ok: true, data: { state: "none" } };
  }
  const record = await readDemoPass(ctx, userId);
  if (!record) return { ok: false, code: "NO_PASS" };
  const expired: DemoPassRecord = { ...record, expiresAt: new Date(now.getTime() - 1000).toISOString() };
  await writeDemoPass(ctx, userId, expired);
  return { ok: true, data: toPassStatusDto(passStateOf(expired, now)) };
}
