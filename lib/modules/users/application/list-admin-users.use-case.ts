import { AppContext } from "@/lib/modules/shared/app-context";
import { Prisma } from "@prisma/client";
import { normalizePaymentTotals } from "../domain/payment-totals";

export interface ListAdminUsersInput {
  query?: string;
  role?: string;
  isPatron?: boolean;
  isDeleted?: boolean;
  language?: string;
  patronSource?: string;
  hasPayments?: boolean;
  hasSubscriptions?: boolean;
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}

export interface AdminUserListItemDto {
  id: string;
  email: string | null;
  name: string | null;
  username: string | null;
  imageUrl: string | null;
  role: string;
  isPatron: boolean;
  isDeleted: boolean;
  patronSince: Date | null;
  patronSource: string | null;
  language: string | null;
  createdAt: Date;
  updatedAt: Date;
  hasSubscriptions: boolean;
  paymentCount: number;
  lastPaymentAt: Date | null;
  referralPoints: number;
  referralCount: number;
  paymentTotals: Array<{
    currency: string;
    totalPaidMinor: number;
  }>;
  normalizedTotal: number;
}

export interface ListAdminUsersResult {
  items: AdminUserListItemDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function listAdminUsers(
  input: ListAdminUsersInput,
  ctx: AppContext
): Promise<ListAdminUsersResult> {
  const { prisma } = ctx;

  const page = input.page || 1;
  const pageSize = input.pageSize || 50;
  const skip = (page - 1) * pageSize;

  const where: Prisma.UserWhereInput = {
      AND: [
        input.query ? {
          OR: [
            { email: { contains: input.query, mode: 'insensitive' } },
            { name: { contains: input.query, mode: 'insensitive' } },
            { username: { contains: input.query, mode: 'insensitive' } },
          ]
        } : {},
        input.role ? { role: input.role as any } : {},
        input.isPatron !== undefined ? { isPatron: input.isPatron } : {},
        input.language ? { language: input.language } : {},
        input.isDeleted !== undefined ? { isDeleted: input.isDeleted } : {},
        input.patronSource ? { patronSource: input.patronSource as any } : {},
        input.hasPayments ? { payments: { some: {} } } : {},
        input.hasSubscriptions ? { subscriptions: { some: {} } } : {},
      ]
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        paymentTotals: true,
        _count: {
          select: {
            payments: true,
            referrals: true,
            subscriptions: true
          }
        },
        payments: {
            where: { status: 'SUCCEEDED' },
            orderBy: { createdAt: 'desc' },
            take: 1
        }
      },
      orderBy: { [input.orderBy || 'createdAt']: input.orderDir || 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.user.count({ where })
  ]);

  return {
    items: users.map(u => {
        const domainTotals = u.paymentTotals.map((pt: any) => ({
            currency: pt.currency,
            amountMinor: pt.amountMinor
        }));

        const dtoTotals = domainTotals.map(t => ({
            currency: t.currency,
            totalPaidMinor: t.amountMinor
        }));

        return {
            id: u.id,
            email: u.email,
            name: u.name,
            username: u.username,
            imageUrl: u.imageUrl,
            role: u.role,
            isPatron: u.isPatron,
            isDeleted: u.isDeleted,
            patronSince: u.patronSince,
            patronSource: u.patronSource,
            language: u.language,
            createdAt: u.createdAt,
            updatedAt: u.updatedAt,
            hasSubscriptions: u._count.subscriptions > 0,
            paymentCount: u._count.payments,
            lastPaymentAt: u.payments[0]?.createdAt || null,
            referralPoints: u.referralPoints,
            referralCount: u._count.referrals,
            paymentTotals: dtoTotals,
            normalizedTotal: normalizePaymentTotals(domainTotals)
        };
    }),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  };
}
