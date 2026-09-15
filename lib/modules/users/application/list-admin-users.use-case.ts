import { AppContext } from "@/lib/modules/shared/app-context";
import { PaymentStatus, Prisma } from "@prisma/client";
import { normalizePaymentTotals } from "../domain/payment-totals";
import { PatronTruthReadModel, buildPatronTruthReadModel } from "./patron-read-model";

type AdminUserOrderBy = NonNullable<ListAdminUsersInput['orderBy']>;

const GRANT_BACKED_PATRON_SORT_FIELDS = new Set<AdminUserOrderBy>(['patronSince', 'activeGrantSince']);

export interface AdminPatronQuerySortContractDto {
  patronStatusFilterSource: 'ACTIVE_PATRON_GRANT';
  patronSourceFilterSource: 'ACTIVE_PATRON_GRANT';
  patronSinceSortSource: 'ACTIVE_PATRON_GRANT_FIRST_CREATED_AT';
  compatibilityAliases: {
    orderByPatronSince: 'activeGrantSince';
  };
}

export const ADMIN_PATRON_QUERY_SORT_CONTRACT: AdminPatronQuerySortContractDto = {
  patronStatusFilterSource: 'ACTIVE_PATRON_GRANT',
  patronSourceFilterSource: 'ACTIVE_PATRON_GRANT',
  patronSinceSortSource: 'ACTIVE_PATRON_GRANT_FIRST_CREATED_AT',
  compatibilityAliases: {
    orderByPatronSince: 'activeGrantSince',
  },
};


const adminUserListInclude = Prisma.validator<Prisma.UserInclude>()({
  paymentTotals: true,
  _count: {
    select: {
      payments: true,
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
  isPatron: boolean;
  isDeleted: boolean;
  patronSince: Date | null;
  patronSource: string | null;
  activeGrantSince: Date | null;
  /** Grant-backed first active PatronGrant source; canonical patron source read field. */
  activeGrantSource: string | null;
  /** Count of active PatronGrant rows; canonical patron truth count. */
  activeGrantCount: number;
  patronTruth: PatronTruthReadModel;
  language: string | null;
  createdAt: Date;
  updatedAt: Date;
  hasSubscriptions: boolean;
  paymentCount: number;
  lastPaymentAt: Date | null;
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

/**
 * Escapes ILIKE wildcard metacharacters so free-text search behaves as a
 * literal substring match (matching Prisma's `contains` semantics) instead of
 * letting a user-typed `%`/`_` act as a SQL wildcard.
 */
function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Builds the WHERE-clause fragment for the raw, DB-paginated grant-backed
 * patron sort query below. Mirrors the `where` object built in
 * `listAdminUsers` field-for-field so both code paths (the typed Prisma
 * `orderBy` branch and this raw-SQL branch) filter identically. Every
 * user-supplied value is passed as a bound query parameter via
 * `Prisma.sql`/`Prisma.join` — never string-interpolated into the SQL text —
 * so this stays injection-safe.
 */
function buildAdminUserRawWhere(input: ListAdminUsersInput): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];

  if (input.query) {
    const pattern = `%${escapeLikePattern(input.query)}%`;
    conditions.push(Prisma.sql`(u.email ILIKE ${pattern} ESCAPE '\\' OR u.name ILIKE ${pattern} ESCAPE '\\' OR u.username ILIKE ${pattern} ESCAPE '\\')`);
  }
  if (input.role) {
    conditions.push(Prisma.sql`u.role = ${input.role}::"SystemRole"`);
  }
  if (input.isPatron !== undefined) {
    conditions.push(
      input.isPatron
        ? Prisma.sql`EXISTS (SELECT 1 FROM "PatronGrant" pg WHERE pg."userId" = u.id AND pg."revokedAt" IS NULL)`
        : Prisma.sql`NOT EXISTS (SELECT 1 FROM "PatronGrant" pg WHERE pg."userId" = u.id AND pg."revokedAt" IS NULL)`
    );
  }
  if (input.language) {
    conditions.push(Prisma.sql`u.language = ${input.language}`);
  }
  if (input.isDeleted !== undefined) {
    conditions.push(Prisma.sql`u."isDeleted" = ${input.isDeleted}`);
  }
  if (input.patronSource) {
    conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "PatronGrant" pg2 WHERE pg2."userId" = u.id AND pg2.source = ${input.patronSource}::"PatronGrantSource" AND pg2."revokedAt" IS NULL)`);
  }
  if (input.hasPayments) {
    conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "Payment" p WHERE p."userId" = u.id)`);
  }
  if (input.hasSubscriptions) {
    conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM "Subscription" s WHERE s."userId" = u.id)`);
  }

  return conditions.length ? Prisma.join(conditions, ' AND ') : Prisma.sql`TRUE`;
}

/**
 * Resolves one page of user IDs for the grant-backed patron sort
 * (`orderBy` = `patronSince` / `activeGrantSince`), entirely at the database
 * level. The sort key — the earliest still-active PatronGrant.createdAt per
 * user — lives on a related table and can't be expressed via Prisma's typed
 * `orderBy` (relation-aggregate ordering only supports `_count`, not
 * `_min`/`_max` — confirmed against the generated `PatronGrantOrderByRelationAggregateInput`,
 * which exposes only `_count`). This uses a raw query with a LEFT JOIN
 * against a per-user MIN(createdAt) aggregate (over active grants only),
 * ORDER BY that aggregate, and LIMIT/OFFSET pushed down to Postgres — so only
 * this page's IDs come back, never the full filtered table. Nulls (no active
 * grant) always sort last regardless of orderDir, matching the previous
 * in-memory comparator's behavior.
 */
async function fetchGrantBackedSortedUserIds(
  ctx: AppContext,
  input: ListAdminUsersInput,
  orderDir: 'asc' | 'desc',
  skip: number,
  pageSize: number
): Promise<string[]> {
  const whereSql = buildAdminUserRawWhere(input);
  const orderDirSql = orderDir === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;

  const rows = await ctx.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT u.id
    FROM "User" u
    LEFT JOIN (
      SELECT "userId", MIN("createdAt") AS "activeGrantSince"
      FROM "PatronGrant"
      WHERE "revokedAt" IS NULL
      GROUP BY "userId"
    ) ag ON ag."userId" = u.id
    WHERE ${whereSql}
    ORDER BY ag."activeGrantSince" ${orderDirSql} NULLS LAST, u."createdAt" ASC, u.id ASC
    LIMIT ${pageSize}
    OFFSET ${skip}
  `);

  return rows.map((row) => row.id);
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

  const [users, total] = await Promise.all([
    (async (): Promise<AdminUserListRecord[]> => {
      if (!usesGrantBackedPatronSort) {
        return prisma.user.findMany({
          where,
          include: adminUserListInclude,
          orderBy: { [orderBy]: orderDir },
          skip,
          take: pageSize,
        });
      }

      // Grant-backed sort: resolve the page's user IDs via a bounded raw
      // query (see fetchGrantBackedSortedUserIds), then hydrate just those
      // records — never the full filtered table — preserving that DB-decided
      // order.
      const orderedIds = await fetchGrantBackedSortedUserIds(ctx, input, orderDir, skip, pageSize);
      if (orderedIds.length === 0) return [];

      const records = await prisma.user.findMany({
        where: { id: { in: orderedIds } },
        include: adminUserListInclude,
      });
      const byId = new Map(records.map((record) => [record.id, record]));
      return orderedIds
        .map((id) => byId.get(id))
        .filter((record): record is AdminUserListRecord => Boolean(record));
    })(),
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

        const patronTruth = buildPatronTruthReadModel(u.patronGrants);

        return {
            id: u.id,
            email: u.email,
            name: u.name,
            username: u.username,
            imageUrl: u.imageUrl,
            role: u.role,
            isPatron: patronTruth.isPatron,
            isDeleted: u.isDeleted,
            patronSince: patronTruth.activeGrantSince,
            patronSource: patronTruth.activeGrantSource,
            activeGrantSince: patronTruth.activeGrantSince,
            activeGrantSource: patronTruth.activeGrantSource,
            activeGrantCount: patronTruth.activeGrantCount,
            patronTruth,
            language: u.language,
            createdAt: u.createdAt,
            updatedAt: u.updatedAt,
            hasSubscriptions: u._count.subscriptions > 0,
            paymentCount: u._count.payments,
            lastPaymentAt: u.payments[0]?.createdAt || null,
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
