import { AppContext } from "@/lib/modules/shared/app-context";
import { Prisma, SystemRole, PatronGrantSource } from "@prisma/client";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { normalizePaymentTotals } from "../domain/payment-totals";
import { PatronCacheReadModel, PatronTruthReadModel, buildPatronCacheReadModel, buildPatronTruthReadModel } from "./patron-read-model";
import { ADMIN_PATRON_QUERY_SORT_CONTRACT, AdminPatronQuerySortContractDto } from "./list-admin-users.use-case";
import { writeAuditLog } from "@/lib/services/audit.service";

export interface ExportAdminUsersInput {
  query?: string;
  role?: SystemRole;
  isPatron?: boolean;
  patronSource?: PatronGrantSource;
  isDeleted?: boolean;
  language?: string;
  hasPayments?: boolean;
  hasSubscriptions?: boolean;
}

export interface ExportAdminUserDto {
  id: string;
  email: string | null;
  name: string | null;
  username: string | null;
  role: string;
  /** Deprecated admin export cache field. Use patronTruth.isPatron for access truth. */
  isPatron: boolean;
  /** Deprecated admin export cache field retained for existing CSV/header compatibility. */
  patronSince: Date | null;
  /** Deprecated admin export cache field retained for existing CSV/header compatibility. */
  patronSource: string | null;
  /** Grant-backed first active PatronGrant date for new admin exports/readers. */
  activeGrantSince: Date | null;
  /** Grant-backed first active PatronGrant source for new admin exports/readers. */
  activeGrantSource: string | null;
  /** Grant-backed active PatronGrant count for new admin exports/readers. */
  activeGrantCount: number;
  patronCache: PatronCacheReadModel;
  patronTruth: PatronTruthReadModel;
  patronCacheTruthMismatch: boolean;
  normalizedTotal: number;
  language: string | null;
  isDeleted: boolean;
  createdAt: Date;
  patronQuerySortContract: AdminPatronQuerySortContractDto;
}

export async function exportAdminUsers(
  input: ExportAdminUsersInput,
  ctx: AppContext
): Promise<UseCaseResult<ExportAdminUserDto[], Error>> {
  const { prisma, actor } = ctx;

  if (actor.type !== 'admin') {
    return fail(new Error("Forbidden: Admin access required"));
  }

  const where: Prisma.UserWhereInput = {
    AND: [
      input.query ? {
        OR: [
          { email: { contains: input.query, mode: 'insensitive' } },
          { name: { contains: input.query, mode: 'insensitive' } },
          { username: { contains: input.query, mode: 'insensitive' } },
        ]
      } : {},
      input.role ? { role: input.role } : {},
      input.isPatron !== undefined
        ? input.isPatron
          ? { patronGrants: { some: { revokedAt: null } } }
          : { patronGrants: { none: { revokedAt: null } } }
        : {},
      input.language ? { language: input.language } : {},
      input.isDeleted !== undefined ? { isDeleted: input.isDeleted } : {},
      input.patronSource ? { patronGrants: { some: { source: input.patronSource, revokedAt: null } } } : {},
      input.hasPayments ? { payments: { some: {} } } : {},
      input.hasSubscriptions ? { subscriptions: { some: {} } } : {},
    ]
  };

  const users = await prisma.user.findMany({
    where,
    include: {
      paymentTotals: true,
      patronGrants: {
        where: { revokedAt: null },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' }
  });

  const items: ExportAdminUserDto[] = users.map(user => {
    const patronCache = buildPatronCacheReadModel(user);
    const patronTruth = buildPatronTruthReadModel(user.patronGrants);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      role: user.role,
      isPatron: user.isPatron,
      patronSince: user.patronSince,
      patronSource: user.patronSource,
      activeGrantSince: patronTruth.activeGrantSince,
      activeGrantSource: patronTruth.activeGrantSource,
      activeGrantCount: patronTruth.activeGrantCount,
      patronCache,
      patronTruth,
      patronCacheTruthMismatch: patronCache.isPatron !== patronTruth.isPatron,
      normalizedTotal: normalizePaymentTotals(user.paymentTotals.map(pt => ({
        currency: pt.currency,
        amountMinor: pt.amountMinor
      }))),
      language: user.language,
      isDeleted: user.isDeleted,
      createdAt: user.createdAt,
      patronQuerySortContract: ADMIN_PATRON_QUERY_SORT_CONTRACT
    };
  });

  await writeAuditLog({
    actorUserId: actor.userId,
    action: "USERS_EXPORT",
    targetType: "System",
    metadata: { filterOptions: input as
any, count: items.length }
  });

  return ok(items);
}
