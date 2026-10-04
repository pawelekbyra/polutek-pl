import { PatronGrantSource } from "@prisma/client";
import { AppContext } from "@/lib/modules/shared/app-context";
import { WriteTx } from "@/lib/modules/shared/db";
import { grantPatron } from "@/lib/modules/patron";
import { recordAuditEvent } from "@/lib/modules/audit";
import { PaymentRepository } from "../infrastructure/payment.repository";

/**
 * Supporter bookkeeping ("wpłacił = patron", owner decision 2026-10-03).
 *
 * Every successful tip marks the payer as a supporter, with no amount threshold. The marker is a
 * `PatronGrant` row with source STRIPE_TIP; it grants nothing (access never depends on it). One
 * active grant per user is enough: later tips don't add rows.
 *
 * A refund or dispute of one tip only takes the marker away when the user has no other paid,
 * not (fully) refunded tip left. Grants given by an admin, a migration or legacy data are never
 * revoked here.
 */

/** Creates the supporter marker for this payment unless the user already has an active one. */
export async function ensureSupporterGrant(
  input: { userId: string; paymentId: string },
  ctx: AppContext,
  tx: WriteTx,
): Promise<{ created: boolean }> {
  const active = await tx.patronGrant.findFirst({
    where: { userId: input.userId, revokedAt: null },
    select: { id: true },
  });
  if (active) return { created: false };

  const result = await grantPatron({
    userId: input.userId,
    source: "stripe_tip",
    paymentId: input.paymentId,
    note: "Successful tip",
  }, ctx, tx);
  if (!result.ok) throw new Error(`PATRON_GRANT_FAILED: ${result.error.message}`);
  return { created: true };
}

/**
 * After a payment stopped counting (full refund, dispute opened or lost): revokes the user's
 * STRIPE_TIP markers, but only when no other paid tip remains.
 */
export async function revokeSupporterGrantIfNoPaidTips(
  input: { userId: string; paymentId: string; revokeReason: string },
  ctx: AppContext,
  tx: WriteTx,
): Promise<{ revoked: number }> {
  const repo = new PaymentRepository();
  const countable = await repo.findCountablePayments(input.userId, tx);
  if (countable.length > 0) return { revoked: 0 };

  const { count } = await tx.patronGrant.updateMany({
    where: { userId: input.userId, source: PatronGrantSource.STRIPE_TIP, revokedAt: null },
    data: { revokedAt: ctx.now(), revokedById: null, revokeReason: input.revokeReason },
  });
  if (count > 0) {
    await recordAuditEvent(ctx, {
      action: "PATRON_REVOKED",
      targetType: "User",
      targetId: input.userId,
      metadata: { paymentId: input.paymentId, revokeReason: input.revokeReason, count },
    }, tx);
  }
  return { revoked: count };
}

/**
 * After a dispute closed in the user's favour: brings back the markers that this dispute took away
 * (matched by the exact revokeReason it wrote), as long as a paid tip counts again.
 */
export async function restoreSupporterGrantRevokedFor(
  input: { userId: string; revokeReason: string },
  ctx: AppContext,
  tx: WriteTx,
): Promise<{ restored: number }> {
  const repo = new PaymentRepository();
  const countable = await repo.findCountablePayments(input.userId, tx);
  if (countable.length === 0) return { restored: 0 };

  const { count } = await tx.patronGrant.updateMany({
    where: {
      userId: input.userId,
      source: PatronGrantSource.STRIPE_TIP,
      revokedAt: { not: null },
      revokeReason: input.revokeReason,
    },
    data: { revokedAt: null, revokedById: null, revokeReason: null },
  });
  if (count > 0) {
    await recordAuditEvent(ctx, {
      action: "PATRON_GRANTED",
      targetType: "User",
      targetId: input.userId,
      metadata: { restored: true, previousRevokeReason: input.revokeReason, count },
    }, tx);
  }
  return { restored: count };
}
