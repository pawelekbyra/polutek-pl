// patron zone (docs/architecture/patron-zone.md)
// The access as it counts NOW: the stored grant (`xp.premium_pass:<User.id>`) minus the periods of its payments that a
// dispute holds (owner decision DP01, 2026-11-25). Every reader that decides access or the VIP marker goes through here;
// the grant/revoke writers keep reading the stored record (readPass).
// Nothing is cached: the Payment status is read with the grant on every decision, so a status change (dispute opened,
// won or lost) takes effect on the next read without any invalidation. Only Payment rows are read, never written.
import { PaymentStatus } from "@prisma/client";
import type { DbClient } from "@/lib/modules/shared/db";
import { isRecordActive, withoutHeldPayments, type HeldPassPayment, type PassRecord } from "../domain/pass-state";
import { readPass } from "../infrastructure/pass-store";
import { readPaymentProductId } from "./patron-grant";

export type PassReadDb = Pick<DbClient, "appSetting" | "payment">;

/** A payment in these statuses gives no access: dispute open (suspended until won) or lost (taken away). */
export const PASS_HOLD_STATUSES: readonly PaymentStatus[] = [PaymentStatus.DISPUTED, PaymentStatus.CHARGEBACK_LOST];

/** Only a real (Stripe) grant that is active by its stored end can lose anything; everything else needs no lookup. */
function canBeHeld(record: PassRecord | null, now: Date): record is PassRecord {
  return record !== null && record.provider === "STRIPE" && record.paymentIds.length > 0 && isRecordActive(record, now);
}

/** The payments among `paymentIds` that a dispute holds now, in ONE query (no per-payment lookups). */
export async function findHeldPassPayments(db: Pick<DbClient, "payment">, paymentIds: Iterable<string>): Promise<HeldPassPayment[]> {
  const ids = [...new Set(paymentIds)];
  if (ids.length === 0) return [];
  const rows = await db.payment.findMany({
    where: { id: { in: ids }, status: { in: [...PASS_HOLD_STATUSES] } },
    select: { id: true, metadata: true },
  });
  return rows.map((row) => ({ paymentId: row.id, productId: readPaymentProductId(row.metadata) }));
}

/** The effective form of each record (same order), with one payment query for all of them. */
export async function applyPaymentHolds(db: Pick<DbClient, "payment">, records: ReadonlyArray<PassRecord | null>, now: Date): Promise<Array<PassRecord | null>> {
  const candidates = records.filter((record): record is PassRecord => canBeHeld(record, now));
  if (candidates.length === 0) return [...records];
  const held = await findHeldPassPayments(db, candidates.flatMap((record) => record.paymentIds));
  if (held.length === 0) return [...records];
  return records.map((record) => (canBeHeld(record, now) ? withoutHeldPayments(record, held) : record));
}

/** One account's grant as it counts now (access gate, sidebar, shelf, status endpoint). */
export async function readEffectivePass(db: PassReadDb, userId: string, now: Date): Promise<PassRecord | null> {
  const [record] = await applyPaymentHolds(db, [await readPass(db, userId)], now);
  return record ?? null;
}
