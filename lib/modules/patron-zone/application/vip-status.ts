// patron zone (docs/architecture/patron-zone.md)
// The public "VIP" marker of a comment author: a yes/no fact derived ONLY from the paid patron-zone access grant.
// Tips and donations never reach it: tips are recorded as PatronGrant rows (the owner's private ledger) and never write
// the `xp.premium_pass:<User.id>` row that is read here, so a tip can never buy a public distinction (CLAUDE.md 4.1).
// Privacy: the answer is a bare set of account ids; no purchase date, product, price or expiry leaves this module.
import { isRecordActive, parsePassRecord, type PassRecord } from "../domain/pass-state";
import { PASS_KEY_PREFIX, passKey } from "../infrastructure/pass-store";
import { applyPaymentHolds, type PassReadDb } from "./effective-pass";

/** One page of comments never has more authors than this; a larger input is split so the query stays small. */
const VIP_LOOKUP_CHUNK = 500;

/**
 * VIP = a REAL (Stripe) payment gave an access that is running now: a 30-day or 3-month access until its end (no access
 * is unlimited). A simulated (DEMO) checkout moved no money and gives no marker; an expired or fully refunded access
 * (a refund takes its period back out) is no longer active, so the marker disappears with it at `expiresAt`.
 * Pass the EFFECTIVE record (applyPaymentHolds/readEffectivePass): a payment whose dispute is open or lost gives no
 * marker either (DP01), and it comes back by itself when the dispute is won.
 */
export function isVipRecord(record: PassRecord | null, now: Date): boolean {
  return record !== null && record.provider === "STRIPE" && isRecordActive(record, now);
}

/**
 * The accounts among `userIds` that hold an active paid patron-zone access, read with ONE query per chunk of 500
 * ids (a comment page needs one) plus, only when some of them hold an active paid access, ONE Payment query for the
 * dispute holds of the whole chunk: no per-author lookups. Unknown ids and unreadable rows are simply not VIP.
 * The comment badge and the avatar ring (getOwnRoleBadge) both come from here, so both follow a dispute.
 */
export async function listVipUserIds(db: PassReadDb, userIds: Iterable<string>, now: Date): Promise<Set<string>> {
  const unique = [...new Set([...userIds].filter((id) => typeof id === "string" && id.length > 0))];
  const vip = new Set<string>();
  for (let start = 0; start < unique.length; start += VIP_LOOKUP_CHUNK) {
    const chunk = unique.slice(start, start + VIP_LOOKUP_CHUNK);
    const rows = await db.appSetting.findMany({
      where: { key: { in: chunk.map(passKey) } },
      select: { key: true, value: true },
    });
    const owned = rows
      .filter((row) => row.key.startsWith(PASS_KEY_PREFIX))
      .map((row) => ({ userId: row.key.slice(PASS_KEY_PREFIX.length), record: parsePassRecord(row.value) }))
      .filter(({ record }) => isVipRecord(record, now));
    const effective = await applyPaymentHolds(db, owned.map(({ record }) => record), now);
    owned.forEach(({ userId }, index) => {
      if (isVipRecord(effective[index] ?? null, now)) vip.add(userId);
    });
  }
  return vip;
}
