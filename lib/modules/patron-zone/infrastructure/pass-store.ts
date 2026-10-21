// patron zone (docs/architecture/patron-zone.md)
// The only reader and writer of the patron zone AppSetting rows (no schema change, no migration):
//   xp.premium_pass:<User.id>              the patron-zone access grant of an account (JSON, zod-checked on read)
//   xp.premium_pass.stats:<YYYY-MM-DD>     anonymous daily funnel counters (no account id)
// The `xp.premium_pass` key prefix is historical and stays (renaming it would orphan every grant). The real money is in the existing
// Payment ledger, written by the payments module, never here; nothing here touches PatronGrant, Order, Entitlement
// or LedgerEntry.
import type { AppContext } from "@/lib/modules/shared/app-context";
import type { DbClient, WriteTx } from "@/lib/modules/shared/db";
import { parsePassRecord, type PassRecord } from "../domain/pass-state";

export const PASS_KEY_PREFIX = "xp.premium_pass:";
export const STATS_KEY_PREFIX = "xp.premium_pass.stats:";

export const passKey = (userId: string) => `${PASS_KEY_PREFIX}${userId}`;

export async function readPass(db: Pick<DbClient, "appSetting">, userId: string): Promise<PassRecord | null> {
  const row = await db.appSetting.findUnique({ where: { key: passKey(userId) }, select: { value: true } });
  return parsePassRecord(row?.value);
}

export async function writePass(db: Pick<DbClient, "appSetting">, userId: string, record: PassRecord): Promise<void> {
  const value = JSON.stringify(record);
  await db.appSetting.upsert({
    where: { key: passKey(userId) },
    create: { key: passKey(userId), value, updatedBy: "patron-zone" },
    update: { value, updatedBy: "patron-zone" },
  });
}

export async function deletePass(db: Pick<DbClient, "appSetting">, userId: string): Promise<void> {
  await db.appSetting.deleteMany({ where: { key: passKey(userId) } });
}

/**
 * Serializes read-modify-write of one account's grant inside a transaction (two payments of the same account
 * fulfilled at once must both count). The row may not exist yet, so a transaction-scoped advisory lock is used.
 */
export async function lockPass(tx: WriteTx, userId: string): Promise<void> {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${passKey(userId)}))::text AS locked`;
}

export const FUNNEL_EVENTS = ["offer_view", "checkout_open", "checkout_submit", "demo_success", "demo_declined", "intent_created", "max_ahead"] as const;
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
    await ctx.prisma.appSetting.upsert({ where: { key }, create: { key, value, updatedBy: "patron-zone" }, update: { value } });
  } catch (error) {
    console.warn("[premium-pass] funnel counter not saved", error instanceof Error ? error.message : "unknown");
  }
}
