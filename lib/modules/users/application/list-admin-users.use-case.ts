import { AppContext } from "@/lib/modules/shared/app-context";
import { Prisma } from "@prisma/client";
import { normalizePaymentTotals } from "../domain/payment-totals";
import { PatronCacheReadModel, PatronTruthReadModel, buildPatronCacheReadModel, buildPatronTruthReadModel } from "./patron-read-model";

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
  /** Deprecated admin cache field. Use patronTruth.isPatron for access truth. */
  isPatron: boolean;
  isDeleted: boolean;
  patronSince: Date | null;
  patronSource: string | null;
  patronCache: PatronCacheReadModel;
  patronTruth: PatronTruthReadModel;
  patronCacheTruthMismatch: boolean;
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
        input.isPatron !== undefined
          ? input.isPatron
            ? { patronGrants: { some: { revokedAt: null } } }
            : { patronGrants: { none: { revokedAt: null } } }
          : {},
        input.language ? { language: input.language } : {},
        input.isDeleted !== undefined ? { isDeleted: input.isDeleted } : {},
        input.patronSource ? { patronGrants: { some: { source: input.patronSource as any, revokedAt: null } } } : {},
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
        },
        patronGrants: {
            where: { revokedAt: null },
            orderBy: { createdAt: 'asc' }
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

        const patronCache = buildPatronCacheReadModel(u);
        const patronTruth = buildPatronTruthReadModel(u.patronGrants);

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
            patronCache,
            patronTruth,
            patronCacheTruthMismatch: patronCache.isPatron !== patronTruth.isPatron,
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
