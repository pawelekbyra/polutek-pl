import { AppContext } from "@/lib/modules/shared/app-context";
import { Prisma, SystemRole, PatronGrantSource } from "@prisma/client";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { normalizePaymentTotals } from "../domain/payment-totals";
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
  isPatron: boolean;
  patronSince: Date | null;
  patronSource: string | null;
  normalizedTotal: number;
  language: string | null;
  isDeleted: boolean;
  createdAt: Date;
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
      input.isPatron !== undefined ? { isPatron: input.isPatron } : {},
      input.language ? { language: input.language } : {},
      input.isDeleted !== undefined ? { isDeleted: input.isDeleted } : {},
      input.patronSource ? { patronSource: input.patronSource } : {},
      input.hasPayments ? { payments: { some: {} } } : {},
      input.hasSubscriptions ? { subscriptions: { some: {} } } : {},
    ]
  };

  const users = await prisma.user.findMany({
    where,
    include: {
      paymentTotals: true,
    },
    orderBy: { createdAt: 'desc' }
  });

  const items: ExportAdminUserDto[] = users.map(user => ({
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    role: user.role,
    isPatron: user.isPatron,
    patronSince: user.patronSince,
    patronSource: user.patronSource,
    normalizedTotal: normalizePaymentTotals(user.paymentTotals.map(pt => ({
      currency: pt.currency,
      amountMinor: pt.amountMinor
    }))),
    language: user.language,
    isDeleted: user.isDeleted,
    createdAt: user.createdAt
  }));

  await writeAuditLog({
    actorUserId: actor.userId,
    action: "USERS_EXPORT",
    targetType: "System",
    metadata: { filterOptions: input as any, count: items.length }
  });

  return ok(items);
}
