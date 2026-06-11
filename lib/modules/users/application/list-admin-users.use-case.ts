import { AppContext } from "@/lib/modules/shared/app-context";
import { PaymentStatus, Prisma } from "@prisma/client";
import { normalizePaymentTotals } from "../domain/payment-totals";
import { PatronCacheReadModel, PatronTruthReadModel, buildPatronCacheReadModel, buildPatronTruthReadModel } from "./patron-read-model";

type AdminUserOrderBy = NonNullable<ListAdminUsersInput['orderBy']>;

const GRANT_BACKED_PATRON_SORT_FIELDS = new Set<AdminUserOrderBy>(['patronSince', 'activeGrantSince']);

export interface AdminPatronQuerySortContractDto {
  patronStatusFilterSource: 'ACTIVE_PATRON_GRANT';
  patronSourceFilterSource: 'ACTIVE_PATRON_GRANT';
  patronSinceSortSource: 'ACTIVE_PATRON_GRANT_FIRST_CREATED_AT';
  legacyPatronCacheFields: Array<'isPatron' | 'patronSince' | 'patronSource'>;
  cacheFieldSource: 'USER_PATRON_CACHE';
  compatibilityAliases: {
    orderByPatronSince: 'activeGrantSince';
  };
}

export const ADMIN_PATRON_QUERY_SORT_CONTRACT: AdminPatronQuerySortContractDto = {
  patronStatusFilterSource: 'ACTIVE_PATRON_GRANT',
  patronSourceFilterSource: 'ACTIVE_PATRON_GRANT',
  patronSinceSortSource: 'ACTIVE_PATRON_GRANT_FIRST_CREATED_AT',
  legacyPatronCacheFields: ['isPatron', 'patronSince', 'patronSource'],
  cacheFieldSource: 'USER_PATRON_CACHE',
  compatibilityAliases: {
    orderByPatronSince: 'activeGrantSince',
  },
};


const adminUserListInclude = Prisma.validator<Prisma.UserInclude>()({
  paymentTotals: true,
  _count: {
    select: {
      payments: true,
      referrals: true,
      subscriptions: true,
    },
  },
  payments: {
    where: { status: PaymentStatus.SUCCEEDED },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
  patronGrants: {
    where: { revokedAt: null },
    orderBy: { createdAt: 'asc' },
  },
});

type AdminUserListRecord = Prisma.UserGetPayload<{ include: typeof adminUserListInclude }>;

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
  /** Deprecated admin cache field. Use activeGrantSince or patronTruth.activeGrantSince for grant truth. */
  patronSince: Date | null;
  /** Deprecated admin cache field. Use activeGrantSource or patronTruth.activeGrantSource for grant truth. */
  patronSource: string | null;
  /** Grant-backed first active PatronGrant date; canonical patron sort/read field. */
  activeGrantSince: Date | null;
  /** Grant-backed first active PatronGrant source; canonical patron source read field. */
  activeGrantSource: string | null;
  /** Count of active PatronGrant rows; canonical patron truth count. */
  activeGrantCount: number;
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
  patronQuerySortContract: AdminPatronQuerySortContractDto;
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

  const orderBy = input.orderBy || 'createdAt';
  const orderDir = input.orderDir || 'desc';
  const usesGrantBackedPatronSort = GRANT_BACKED_PATRON_SORT_FIELDS.has(orderBy);

  const [fetchedUsers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: adminUserListInclude,
      ...(usesGrantBackedPatronSort
        ? {}
        : {
            orderBy: { [orderBy]: orderDir },
            skip,
            take: pageSize,
          }),
    }),
    prisma.user.count({ where })
  ]);

  const users: AdminUserListRecord[] = usesGrantBackedPatronSort
    ? fetchedUsers
        .slice()
        .sort((a, b) => {
          const aTime = a.patronGrants[0]?.createdAt?.getTime() ?? null;
          const bTime = b.patronGrants[0]?.createdAt?.getTime() ?? null;

          if (aTime === null && bTime === null) return a.createdAt.getTime() - b.createdAt.getTime();
          if (aTime === null) return 1;
          if (bTime === null) return -1;

          return orderDir === 'asc' ? aTime - bTime : bTime - aTime;
        })
        .slice(skip, skip + pageSize)
    : fetchedUsers;

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
            activeGrantSince: patronTruth.activeGrantSince,
            activeGrantSource: patronTruth.activeGrantSource,
            activeGrantCount: patronTruth.activeGrantCount,
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
    totalPages: Math.ceil(total / pageSize),
    patronQuerySortContract: ADMIN_PATRON_QUERY_SORT_CONTRACT
  };
}
