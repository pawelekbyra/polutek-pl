import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Append-only sign-in log of the panel (`AdminAuthEvent`). Every row carries
 * `hash = sha256(prevHash + canonical row)`, written under a transaction-level advisory lock so
 * two concurrent writes cannot fork the chain. The database itself refuses UPDATE and early DELETE
 * (trigger, migration 20261004200000). IDs, outcome and request context only; never secrets.
 */
export type AdminAuthAction =
  | "ADMIN_ENROLL_ISSUED"
  | "ADMIN_ENROLL_RESET"
  | "ADMIN_ENROLL_REDEEMED"
  | "ADMIN_ENROLLED"
  | "ADMIN_SIGN_IN"
  | "ADMIN_SIGN_OUT"
  | "ADMIN_STEP_UP"
  | "ADMIN_SESSION_EXPIRED"
  | "ADMIN_PASSKEY_ADDED"
  | "ADMIN_TOTP_ENABLED"
  | "ADMIN_SESSION_REVOKED"
  | "ADMIN_ACCESS_DENIED";

export type AdminAuthEventInput = {
  action: AdminAuthAction;
  outcome: "success" | "failure";
  adminUserId?: string | null;
  email?: string | null;
  reason?: string | null;
  headers?: Headers | null;
};

const ADVISORY_LOCK_KEY = 726_100_401; // arbitrary, unique to this table

export function canonicalEventString(row: {
  action: string;
  outcome: string;
  adminUserId: string | null;
  email: string | null;
  reason: string | null;
  ip: string | null;
  country: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: Date;
}): string {
  return JSON.stringify([
    row.action,
    row.outcome,
    row.adminUserId,
    row.email,
    row.reason,
    row.ip,
    row.country,
    row.userAgent,
    row.requestId,
    row.createdAt.toISOString(),
  ]);
}

export function chainHash(prevHash: string | null, canonical: string): string {
  return createHash("sha256").update(prevHash ?? "genesis").update("\n").update(canonical).digest("hex");
}

export function requestContext(headers?: Headers | null) {
  const h = headers ?? null;
  const ip = h?.get("cf-connecting-ip")?.trim() || null;
  const country = h?.get("cf-ipcountry")?.trim() || null;
  const ua = h?.get("user-agent")?.slice(0, 300) || null;
  const requestId = h?.get("cf-ray")?.trim() || h?.get("x-request-id")?.trim() || null;
  return { ip, country, userAgent: ua, requestId };
}

export async function recordAdminAuthEvent(input: AdminAuthEventInput): Promise<void> {
  const ctx = requestContext(input.headers);
  const row = {
    action: input.action,
    outcome: input.outcome,
    adminUserId: input.adminUserId ?? null,
    email: input.email?.toLowerCase() ?? null,
    reason: input.reason?.slice(0, 200) ?? null,
    ...ctx,
    createdAt: new Date(),
  };
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_KEY})::text`;
      const last = await tx.adminAuthEvent.findFirst({ orderBy: { seq: "desc" }, select: { hash: true } });
      const prevHash = last?.hash ?? null;
      await tx.adminAuthEvent.create({
        data: { ...row, prevHash, hash: chainHash(prevHash, canonicalEventString(row)) },
      });
    });
  } catch (error) {
    // The event already happened; losing the log line must not turn it into an error for the owner.
    logger.error(`[AdminAuthEvent] failed to record ${input.action}`, error);
  }
}
