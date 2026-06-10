import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { PaymentRepository } from "../infrastructure/payment.repository";
import { PaymentPolicy } from "../domain/payment.policy";
import { PaymentError } from "../domain/payment.errors";
import { AdminPaymentsListResponseDto, PaymentFilterOptions, PAYMENT_SORT_FIELDS, PaymentSortField } from "../domain/admin-payment.dto";
import { Prisma } from "@prisma/client";

export async function listAdminPayments(
  options: PaymentFilterOptions,
  ctx: AppContext
): Promise<UseCaseResult<AdminPaymentsListResponseDto, PaymentError>> {
  if (!PaymentPolicy.canManagePaymentSettings(ctx.actor)) {
    return fail(new PaymentError("Forbidden: Cannot list admin payments"));
  }

  const {
    userId,
    creatorId,
    status,
    currency,
    search,
    dateFrom,
    dateTo,
    refundedOnly,
    page = 1,
    pageSize = 20,
    orderBy = 'createdAt',
    orderDir = 'desc'
  } = options;

  const skip = (page - 1) * pageSize;
  const repo = new PaymentRepository();

  const where: Prisma.PaymentWhereInput = {
    userId,
    creatorId,
    status,
    currency,
    AND: [
      search ? {
        OR: [
          { id: { contains: search, mode: 'insensitive' } },
          { stripeIntentId: { contains: search, mode: 'insensitive' } },
          { stripeSessionId: { contains: search, mode: 'insensitive' } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
          { user: { id: { contains: search, mode: 'insensitive' } } },
        ]
      } : {},
      dateFrom ? { createdAt: { gte: dateFrom } } : {},
      dateTo ? { createdAt: { lte: dateTo } } : {},
      refundedOnly ? { refundedAmountMinor: { gt: 0 } } : {},
    ]
  };

  const sortField = PAYMENT_SORT_FIELDS.includes(orderBy as PaymentSortField) ? orderBy : 'createdAt';
  const prismaOrderBy: Prisma.PaymentOrderByWithRelationInput = { [sortField]: orderDir };

  const [total, items, financialStats] = await Promise.all([
    repo.countPayments(where, ctx.db.read),
    repo.findPaymentsWithRelations({
      where,
      orderBy: prismaOrderBy,
      skip,
      take: pageSize,
    }, ctx.db.read),
    repo.getFinancialStats(where, ctx.db.read)
  ]);

  const mappedItems = items.map(p => ({
    id: p.id,
    userId: p.userId,
    email: p.user.email,
    userName: p.user.name || p.user.username,
    amountMinor: p.amountMinor,
    refundedAmountMinor: p.refundedAmountMinor,
    currency: p.currency,
    status: p.status,
    stripeIntentId: p.stripeIntentId,
    stripeSessionId: p.stripeSessionId,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    metadata: p.metadata,
    creator: p.creator ? {
      id: p.creator.id,
      name: p.creator.name,
      slug: p.creator.slug,
    } : null
  }));

  return ok({
    items: mappedItems,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    summary: {
      totalSucceeded: financialStats.succeeded.map(s => ({ currency: s.currency, amountMinor: s.totalAmount })),
      totalRefunded: financialStats.refunded.map(r => ({ currency: r.currency, amountMinor: r.totalAmount })),
      countByStatus: financialStats.statusCounts.reduce((acc, curr) => ({ ...acc, [curr.status]: curr.count }), {})
    }
  });
}
