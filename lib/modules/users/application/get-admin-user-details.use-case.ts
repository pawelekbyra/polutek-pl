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
  _count: {
    comments: number;
    videoLikes: number;
    videoDislikes: number;
  };
  paymentTotals: any[];
  patronGrants: any[];
  patronDiagnostics: PatronDiagnosticsReadModel;
  payments: any[];
  subscriptions: any[];
  normalizedTotal: number;
  auditLogs: any[];
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
  const patronDiagnostics = buildPatronDiagnosticsReadModel(patronGrants);

  return ok({
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      role: user.role,
      isPatron: patronDiagnostics.truth.isPatron,
      isDeleted: user.isDeleted,
      patronSince: patronDiagnostics.truth.activeGrantSince,
      patronSource: patronDiagnostics.truth.activeGrantSource,
      language: user.language,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      imageUrl: user.imageUrl,
      stripeCustomerId: user.stripeCustomerId,
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
