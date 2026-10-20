// experiment: premium-pass (docs/experiments/premium-pass.md)
// The only reader and writer of the experiment's AppSetting rows (no schema change, no migration):
//   xp.premium_pass:<User.id>              one demo pass per account (JSON, zod-checked on read)
//   xp.premium_pass.stats:<YYYY-MM-DD>     anonymous daily funnel counters (no account id)
// The revert script deletes every `xp.premium_pass%` row. Nothing here touches Payment, PatronGrant, Order,
// Entitlement, LedgerEntry or UserPaymentTotal.
import type { AppContext } from "@/lib/modules/shared/app-context";
import { parseDemoPassRecord, type DemoPassRecord } from "../domain/pass-state";

export const PASS_KEY_PREFIX = "xp.premium_pass:";
export const STATS_KEY_PREFIX = "xp.premium_pass.stats:";

export const passKey = (userId: string) => `${PASS_KEY_PREFIX}${userId}`;

export async function readDemoPass(ctx: Pick<AppContext, "prisma">, userId: string): Promise<DemoPassRecord | null> {
  const row = await ctx.prisma.appSetting.findUnique({ where: { key: passKey(userId) }, select: { value: true } });
  return parseDemoPassRecord(row?.value);
}

export async function writeDemoPass(ctx: Pick<AppContext, "prisma">, userId: string, record: DemoPassRecord): Promise<void> {
  const value = JSON.stringify(record);
  await ctx.prisma.appSetting.upsert({
    where: { key: passKey(userId) },
    create: { key: passKey(userId), value, updatedBy: "experiment:premium-pass" },
    update: { value, updatedBy: "experiment:premium-pass" },
  });
}

export async function deleteDemoPass(ctx: Pick<AppContext, "prisma">, userId: string): Promise<void> {
  await ctx.prisma.appSetting.deleteMany({ where: { key: passKey(userId) } });
}

export const FUNNEL_EVENTS = ["offer_view", "checkout_open", "checkout_submit", "demo_success", "demo_declined", "already_active"] as const;
export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

/**
 * One log line and one daily counter per funnel event, never an account id or e-mail. Best effort: a lost increment
 * under a race or a database error never affects the request.
 */
export async function countFunnelEvent(ctx: Pick<AppContext, "prisma" | "now">, event: FunnelEvent): Promise<void> {
  console.info(`[premium-pass] event=${event}`);
  const key = `${STATS_KEY_PREFIX}${ctx.now().toISOString().slice(0, 10)}`;
  try {
    const row = await ctx.prisma.appSetting.findUnique({ where: { key }, select: { value: true } });
    let counts: Record<string, number> = {};
    try {
      const parsed = row?.value ? JSON.parse(row.value) : {};
      if (parsed && typeof parsed === "object") counts = parsed as Record<string, number>;
    } catch {
      counts = {};
    }
    counts[event] = (Number.isFinite(counts[event]) ? counts[event] : 0) + 1;
    const value = JSON.stringify(counts);
    await ctx.prisma.appSetting.upsert({ where: { key }, create: { key, value, updatedBy: "experiment:premium-pass" }, update: { value } });
  } catch (error) {
    console.warn("[premium-pass] funnel counter not saved", error instanceof Error ? error.message : "unknown");
  }
}
