import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { UserNotFoundError } from "../domain/user.errors";
import { normalizePaymentTotals } from "../domain/payment-totals";
import { PatronDiagnosticsReadModel, buildPatronDiagnosticsReadModel } from "./patron-read-model";

import { UserRepository } from "../infrastructure/user.repository";
import { getUserPayments } from "@/lib/modules/payments";
import { getUserSubscriptions } from "@/lib/modules/subscriptions";
import { getAuditLogs } from "@/lib/modules/audit";

export interface AdminUserDetailsDto {
  id: string;
  email: string | null;
  name: string | null;
  username: string | null;
  role: string;
  isPatron: boolean;
  isDeleted: boolean;
  patronSince: Date | null;
  patronSource: string | null;
  language: string | null;
  createdAt: Date;
  updatedAt: Date;
  imageUrl: string | null;
  stripeCustomerId: string | null;
  referralCode: string | null;
  // Core lookup DTO includes relations count
  _count: {
    comments: number;
    referrals: number;
    videoLikes: number;
    videoDislikes: number;
  };
  paymentTotals:
Array<
any>;
  /** All patron grants for audit/history; active (revokedAt === null) grants are access truth. */
  patronGrants:
Array<
any>;
  /** Patron truth and cache diagnostics. Access truth is active PatronGrant, not User cache fields. */
  patronDiagnostics: PatronDiagnosticsReadModel;
  payments:
Array<
any>;
  subscriptions:
Array<
any>;
  normalizedTotal: number;
  auditLogs:
Array<
any>;
}

export async function getAdminUserDetails(
  userId: string,
  ctx: AppContext
): Promise<UseCaseResult<AdminUserDetailsDto, UserNotFoundError>> {
  const { prisma } = ctx;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      paymentTotals: true,
      _count: {
          select: {
              comments: true,
              referrals: true,
              videoLikes: true,
              videoDislikes: true
          }
      }
    }
  });

  if (!user) return fail(new UserNotFoundError(userId));

  const userRepository = new UserRepository(ctx.db.read);

  const [patronGrants, paymentsResult, subscriptionsResult, auditLogsResult] = await Promise.all([
      userRepository.findPatronGrants(userId),
      getUserPayments(userId, 50, ctx),
      getUserSubscriptions(userId, ctx),
      getAuditLogs({ userId, limit: 100 }, ctx)
  ]);

  const payments = paymentsResult.ok ? paymentsResult.data : [];
  const subscriptions = subscriptionsResult.ok ? subscriptionsResult.data : [];

  const auditLogs = auditLogsResult.ok ? auditLogsResult.data : [];
  const patronDiagnostics = buildPatronDiagnosticsReadModel(user, patronGrants);

  return ok({
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      role: user.role,
      isPatron: user.isPatron,
      isDeleted: user.isDeleted,
      patronSince: user.patronSince,
      patronSource: user.patronSource,
      language: user.language,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      imageUrl: user.imageUrl,
      stripeCustomerId: user.stripeCustomerId,
      referralCode: user.referralCode,
      _count: user._count,
      paymentTotals: user.paymentTotals,
      patronGrants,
      patronDiagnostics,
      payments,
      subscriptions,
      normalizedTotal: normalizePaymentTotals(user.paymentTotals.map(pt => ({
          currency: pt.currency,
          amountMinor: pt.amountMinor
      }))),
      auditLogs
  });
}
