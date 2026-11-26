import { Prisma } from "@prisma/client";
import type { WriteTx } from "@/lib/modules/shared/db";

/**
 * The durable "one purchase confirmation per payment" marker: `Payment.metadata.purchaseConfirmation` (no schema
 * change, the same JSON the other payment markers live in). One atomic UPDATE claims the send, so concurrent
 * fulfilments (webhook, fast path, cron) can never both send:
 *
 *   absent                      -> claim (state `sending`, attempts 1)
 *   `sending`, older than STALE -> the sender died: claim again (attempts + 1, while attempts < MAX)
 *   `failed`, older than RETRY  -> claim again (attempts + 1, while attempts < MAX)
 *   `sent`                      -> never again
 *
 * Only a payment that is still SUCCEEDED can be claimed (a refunded or disputed payment gets no late confirmation).
 */
export type PurchaseConfirmationState = "sending" | "sent" | "failed";

export type PurchaseConfirmationMarker = {
  state: PurchaseConfirmationState;
  attempts: number;
  /** When the state last changed (ISO). */
  at: string;
  /** When the payment was first claimed for the confirmation = the payment date shown in the mail (ISO). */
  paidAt: string;
  sentAt?: string;
  error?: string;
};

export type ClaimResult =
  | { claimed: true; attempts: number; paidAt: Date }
  | { claimed: false; reason: "sent" | "busy" | "exhausted" | "not_eligible" };

export const CONFIRMATION_MAX_ATTEMPTS = 5;
/** A failed send is retried by a later fulfilment event only after this long (no hammering of a broken provider). */
export const CONFIRMATION_RETRY_AFTER_MS = 15 * 60_000;
/** A `sending` claim older than this belongs to a dead process. */
export const CONFIRMATION_STALE_SENDING_MS = 10 * 60_000;

export interface PurchaseConfirmationStore {
  claim(paymentId: string, now: Date, tx: WriteTx): Promise<ClaimResult>;
  markSent(paymentId: string, now: Date, tx: WriteTx): Promise<void>;
  markFailed(paymentId: string, now: Date, error: string, tx: WriteTx): Promise<void>;
}

export function readConfirmationMarker(metadata: unknown): PurchaseConfirmationMarker | null {
  const marker = (metadata as { purchaseConfirmation?: Partial<PurchaseConfirmationMarker> } | null)?.purchaseConfirmation;
  if (!marker || typeof marker !== "object" || typeof marker.state !== "string") return null;
  return marker as PurchaseConfirmationMarker;
}

const MARKER = Prisma.raw(`p."metadata"->'purchaseConfirmation'`);

export class SqlPurchaseConfirmationStore implements PurchaseConfirmationStore {
  async claim(paymentId: string, now: Date, tx: WriteTx): Promise<ClaimResult> {
    const nowIso = now.toISOString();
    const retryCutoff = new Date(now.getTime() - CONFIRMATION_RETRY_AFTER_MS).toISOString();
    const staleCutoff = new Date(now.getTime() - CONFIRMATION_STALE_SENDING_MS).toISOString();
    const rows = await tx.$queryRaw<{ attempts: number; paidAt: string }[]>(Prisma.sql`
      UPDATE "Payment" AS p
      SET "metadata" = jsonb_set(
            COALESCE(p."metadata", '{}'::jsonb),
            '{purchaseConfirmation}',
            jsonb_build_object(
              'state', 'sending',
              'attempts', COALESCE((${MARKER}->>'attempts')::int, 0) + 1,
              'at', ${nowIso}::text,
              'paidAt', COALESCE(${MARKER}->>'paidAt', ${nowIso}::text))),
          "updatedAt" = ${now}
      WHERE p."id" = ${paymentId}
        AND p."status" = 'SUCCEEDED'
        AND jsonb_typeof(COALESCE(p."metadata", '{}'::jsonb)) = 'object'
        AND (
          ${MARKER} IS NULL
          OR (${MARKER}->>'state' = 'failed'
              AND COALESCE((${MARKER}->>'attempts')::int, 0) < ${CONFIRMATION_MAX_ATTEMPTS}
              AND (${MARKER}->>'at')::timestamptz <= ${retryCutoff}::timestamptz)
          OR (${MARKER}->>'state' = 'sending'
              AND COALESCE((${MARKER}->>'attempts')::int, 0) < ${CONFIRMATION_MAX_ATTEMPTS}
              AND (${MARKER}->>'at')::timestamptz <= ${staleCutoff}::timestamptz)
        )
      RETURNING (${MARKER}->>'attempts')::int AS "attempts", ${MARKER}->>'paidAt' AS "paidAt"`);
    if (rows.length === 1) return { claimed: true, attempts: Number(rows[0].attempts), paidAt: new Date(rows[0].paidAt) };

    // Not claimed: say why (informational only, the UPDATE above already decided).
    const row = await tx.payment.findUnique({ where: { id: paymentId }, select: { status: true, metadata: true } });
    if (!row || row.status !== "SUCCEEDED") return { claimed: false, reason: "not_eligible" };
    const marker = readConfirmationMarker(row.metadata);
    if (!marker) return { claimed: false, reason: "not_eligible" };
    if (marker.state === "sent") return { claimed: false, reason: "sent" };
    if (marker.state === "failed" && marker.attempts >= CONFIRMATION_MAX_ATTEMPTS) return { claimed: false, reason: "exhausted" };
    if (marker.state === "sending" && marker.attempts >= CONFIRMATION_MAX_ATTEMPTS) return { claimed: false, reason: "exhausted" };
    return { claimed: false, reason: "busy" };
  }

  async markSent(paymentId: string, now: Date, tx: WriteTx): Promise<void> {
    await this.finish(paymentId, now, "sent", null, tx);
  }

  async markFailed(paymentId: string, now: Date, error: string, tx: WriteTx): Promise<void> {
    await this.finish(paymentId, now, "failed", error.slice(0, 300), tx);
  }

  private async finish(paymentId: string, now: Date, state: "sent" | "failed", error: string | null, tx: WriteTx): Promise<void> {
    const nowIso = now.toISOString();
    const extra = state === "sent" ? { sentAt: nowIso } : { error: error ?? "" };
    await tx.$executeRaw(Prisma.sql`
      UPDATE "Payment" AS p
      SET "metadata" = jsonb_set(
            p."metadata",
            '{purchaseConfirmation}',
            ((${MARKER}) - 'error') || jsonb_build_object('state', ${state}::text, 'at', ${nowIso}::text) || ${JSON.stringify(extra)}::jsonb),
          "updatedAt" = ${now}
      WHERE p."id" = ${paymentId}
        AND ${MARKER}->>'state' = 'sending'`);
  }
}
