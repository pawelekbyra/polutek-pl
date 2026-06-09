import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { createAppContext } from '../modules/shared/app-context';
import { grantPatron, revokePatron } from '../modules/patron';

type DbClient = typeof prisma | Prisma.TransactionClient;

/** @deprecated Use PatronGrantSourceInput from @/lib/modules/patron */
export type PatronGrantSourceInput = 'stripe_tip' | 'referral' | 'admin' | 'migration';

/** @deprecated Use GrantPatronInput from @/lib/modules/patron */
export type GrantPatronOptions = {
  source: PatronGrantSourceInput;
  note?: string;
  grantedByUserId?: string;
  paymentId?: string;
  referralId?: string;
};

/** @deprecated Use RevokePatronInput from @/lib/modules/patron */
export type RevokePatronOptions = {
  note?: string;
  revokedByUserId?: string;
};

/** @deprecated Use PatronNotFoundError from @/lib/modules/patron */
export class PatronStatusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PatronStatusError';
  }
}

/**
 * @deprecated Compatibility bridge. Use grantPatron use case from @/lib/modules/patron instead.
 */
export async function grantPatronStatus(
  userId: string,
  options: GrantPatronOptions,
  db: DbClient = prisma,
) {
  const actor = options.grantedByUserId
    ? { type: 'admin' as const, userId: options.grantedByUserId }
    : { type: 'system' as const, reason: 'legacy_bridge' };

  const ctx = createAppContext(actor);

  // Pass transaction if provided
  const tx = db && '$transaction' in db ? undefined : (db as any);

  const result = await grantPatron({
      userId,
      source: options.source,
      note: options.note,
      grantedByUserId: options.grantedByUserId,
      paymentId: options.paymentId,
      referralId: options.referralId,
  }, ctx, tx);

  if (!result.ok) {
      throw new PatronStatusError(result.error.message);
  }

  // Map result back to legacy shape
  return {
      user: {
          ...result.data,
          id: result.data.userId,
      },
      grant: result.data.activeGrants[0], // approximate
      alreadyGranted: false, // legacy flag, not perfectly mappable without more work
      isPatron: result.data.isPatron,
      becamePatronNow: true, // legacy flag
      normalizedTotal: result.data.normalizedTotal,
  };
}

/**
 * @deprecated Compatibility bridge. Use revokePatron use case from @/lib/modules/patron instead.
 */
export async function revokePatronStatus(
  userId: string,
  options: RevokePatronOptions = {},
  db: DbClient = prisma,
) {
  const actor = options.revokedByUserId
    ? { type: 'admin' as const, userId: options.revokedByUserId }
    : { type: 'system' as const, reason: 'legacy_bridge' };

  const ctx = createAppContext(actor);
  const tx = db && '$transaction' in db ? undefined : (db as any);

  const result = await revokePatron({
      userId,
      note: options.note,
      revokedByUserId: options.revokedByUserId,
  }, ctx, tx);

  if (!result.ok) {
      throw new PatronStatusError(result.error.message);
  }

  return {
      user: {
          ...result.data,
          id: result.data.userId,
      },
      isPatron: false,
      normalizedTotal: result.data.normalizedTotal,
  };
}

export async function syncPatronStatusToClerk(userId: string, isPatron: boolean, normalizedTotal?: number) {
  const { UserAccessService } = await import('./user-access.service');
  await UserAccessService.syncClerkAccess(userId, isPatron, normalizedTotal);
}
