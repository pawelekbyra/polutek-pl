import { logger } from "@/lib/logger";
import { Prisma, PatronGrantSource } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizePaymentTotals, UserAccessService } from './user-access.service';
import { writeAuditLog } from './audit.service';

type DbClient = typeof prisma | Prisma.TransactionClient;

export type PatronGrantSourceInput = 'stripe_tip' | 'referral' | 'admin' | 'migration';

export type GrantPatronOptions = {
  source: PatronGrantSourceInput;
  note?: string;
  grantedByUserId?: string;
  paymentId?: string;
  referralId?: string;
};

export type RevokePatronOptions = {
  note?: string;
  revokedByUserId?: string;
};

const SOURCE_MAP: Record<PatronGrantSourceInput, PatronGrantSource> = {
  stripe_tip: PatronGrantSource.STRIPE_TIP,
  referral: PatronGrantSource.REFERRAL,
  admin: PatronGrantSource.ADMIN,
  migration: PatronGrantSource.MIGRATION,
};

function sourceToEnum(source: PatronGrantSourceInput) {
  return SOURCE_MAP[source];
}

export class PatronStatusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PatronStatusError';
  }
}

export async function grantPatronStatus(
  userId: string,
  options: GrantPatronOptions,
  db: DbClient = prisma,
) {
  const source = sourceToEnum(options.source);

  try {
    // 0. Idempotency check for admin (manual) grants
    if (source === PatronGrantSource.ADMIN) {
        const existingActiveAdminGrant = await db.patronGrant.findFirst({
            where: { userId, source: PatronGrantSource.ADMIN, revokedAt: null }
        });
        if (existingActiveAdminGrant) {
            const user = await db.user.findUniqueOrThrow({
                where: { id: userId },
                include: { paymentTotals: true },
            });
            return {
                user,
                grant: existingActiveAdminGrant,
                alreadyGranted: true,
                isPatron: true,
                becamePatronNow: false,
                normalizedTotal: normalizePaymentTotals(user.paymentTotals),
            };
        }
    }

    // 1. Idempotency check for paymentId
    if (options.paymentId) {
      const existingGrant = await db.patronGrant.findUnique({
        where: { paymentId: options.paymentId },
      });

      if (existingGrant) {
        const user = await db.user.findUniqueOrThrow({
          where: { id: userId },
          include: { paymentTotals: true },
        });
        return {
          user,
          grant: existingGrant,
          alreadyGranted: true,
          isPatron: true,
          becamePatronNow: false,
          normalizedTotal: normalizePaymentTotals(user.paymentTotals),
        };
      }
    }

    // 2. Idempotency check for referralId
    if (options.referralId) {
      const existingGrant = await db.patronGrant.findUnique({
        where: { referralId: options.referralId },
      });

      if (existingGrant) {
        const user = await db.user.findUniqueOrThrow({
          where: { id: userId },
          include: { paymentTotals: true },
        });
        return {
          user,
          grant: existingGrant,
          alreadyGranted: true,
          isPatron: true,
          becamePatronNow: false,
          normalizedTotal: normalizePaymentTotals(user.paymentTotals),
        };
      }
    }

    // 3. Fetch user and update status
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { paymentTotals: true },
    });

    if (!user) {
      throw new PatronStatusError(`Cannot grant Patron status: user ${userId} was not found.`);
    }

    const now = new Date();
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        isPatron: true,
        patronSince: user.isPatron && user.patronSince ? user.patronSince : now,
        patronSource: source,
      },
      include: { paymentTotals: true },
    });

    // 4. Create grant record
    const grant = await db.patronGrant.create({
      data: {
        userId,
        source,
        paymentId: options.paymentId,
        referralId: options.referralId,
        grantedById: options.grantedByUserId,
        reason: options.note,
      },
    });

    const normalizedTotal = normalizePaymentTotals(updatedUser.paymentTotals);
    return {
      user: updatedUser,
      grant,
      alreadyGranted: false,
      isPatron: true,
      becamePatronNow: !user.isPatron,
      normalizedTotal,
    };
  } catch (error) {
    // Handle Race Condition (P2002: Unique constraint failed)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = (error.meta?.target as string[]) || [];
      const paymentIdMatch = options.paymentId && target.includes('paymentId');
      const referralIdMatch = options.referralId && target.includes('referralId');

      if (paymentIdMatch || referralIdMatch) {
        const existingGrant = await db.patronGrant.findUnique({
          where: paymentIdMatch ? { paymentId: options.paymentId } : { referralId: options.referralId },
        });

        if (existingGrant) {
          const user = await db.user.findUniqueOrThrow({
            where: { id: userId },
            include: { paymentTotals: true },
          });
          return {
            user,
            grant: existingGrant,
            alreadyGranted: true,
            isPatron: true,
            becamePatronNow: false,
            normalizedTotal: normalizePaymentTotals(user.paymentTotals),
          };
        }
      }
    }
    throw error;
  }
}

export async function revokePatronStatus(
  userId: string,
  options: RevokePatronOptions = {},
  db: DbClient = prisma,
) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { paymentTotals: true },
  });

  if (!user) {
    throw new PatronStatusError(`Cannot revoke Patron status: user ${userId} was not found.`);
  }

  await db.patronGrant.updateMany({
    where: { userId, revokedAt: null },
    data: {
      revokedAt: new Date(),
      reason: options.note || 'Patron status revoked',
    },
  });

  const updatedUser = await db.user.update({
    where: { id: userId },
    data: {
      isPatron: false,
      patronSince: null,
      patronSource: null,
    },
    include: { paymentTotals: true },
  });

  await writeAuditLog({
    actorUserId: options.revokedByUserId,
    action: 'PATRON_REVOKED',
    targetType: 'User',
    targetId: userId,
    metadata: { note: options.note },
  }).catch((error) => logger.error('[PATRON_REVOKE_AUDIT_ERROR]', error));

  return {
    user: updatedUser,
    isPatron: false,
    normalizedTotal: normalizePaymentTotals(updatedUser.paymentTotals),
  };
}

export async function syncPatronStatusToClerk(userId: string, isPatron: boolean, normalizedTotal?: number) {
  await UserAccessService.syncClerkAccess(userId, isPatron, normalizedTotal);
}
