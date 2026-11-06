// patron zone (docs/architecture/patron-zone.md)
// The public "VIP" marker of a comment author: a yes/no fact derived ONLY from the paid patron-zone access grant.
// Tips and donations never reach it: tips are recorded as PatronGrant rows (the owner's private ledger) and never write
// the `xp.premium_pass:<User.id>` row that is read here, so a tip can never buy a public distinction (CLAUDE.md 4.1).
// Privacy: the answer is a bare set of account ids; no purchase date, product, price or expiry leaves this module.
import type { DbClient } from "@/lib/modules/shared/db";
import { isRecordActive, parsePassRecord, type PassRecord } from "../domain/pass-state";
import { PASS_KEY_PREFIX, passKey } from "../infrastructure/pass-store";

/** One page of comments never has more authors than this; a larger input is split so the query stays small. */
const VIP_LOOKUP_CHUNK = 500;

/**
 * VIP = a REAL (Stripe) payment gave an access that is running now: a 30-day or 3-month access until its end (no access
 * is unlimited). A simulated (DEMO) checkout moved no money and gives no marker; an expired or fully refunded access
 * (a refund takes its period back out) is no longer active, so the marker disappears with it at `expiresAt`.
 */
export function isVipRecord(record: PassRecord | null, now: Date): boolean {
  return record !== null && record.provider === "STRIPE" && isRecordActive(record, now);
}

/**
 * The accounts among `userIds` that hold an active paid patron-zone access, read with ONE query per chunk of 500
 * ids (a comment page needs one): no per-author lookups. Unknown ids and unreadable rows are simply not VIP.
 */
export async function listVipUserIds(db: Pick<DbClient, "appSetting">, userIds: Iterable<string>, now: Date): Promise<Set<string>> {
  const unique = [...new Set([...userIds].filter((id) => typeof id === "string" && id.length > 0))];
  const vip = new Set<string>();
  for (let start = 0; start < unique.length; start += VIP_LOOKUP_CHUNK) {
    const chunk = unique.slice(start, start + VIP_LOOKUP_CHUNK);
    const rows = await db.appSetting.findMany({
      where: { key: { in: chunk.map(passKey) } },
      select: { key: true, value: true },
    });
    for (const row of rows) {
      if (!row.key.startsWith(PASS_KEY_PREFIX)) continue;
      if (isVipRecord(parsePassRecord(row.value), now)) vip.add(row.key.slice(PASS_KEY_PREFIX.length));
    }
  }
  return vip;
}
