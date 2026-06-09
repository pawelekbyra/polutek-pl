import { AppContext } from "@/lib/modules/shared/app-context";
import { UserRepository } from "../infrastructure/user.repository";
import { User, Prisma } from "@prisma/client";

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
  limit?: number;
  orderBy?: string;
  order?: 'asc' | 'desc';
}

export interface AdminUserListItemDto {
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
}

export interface ListAdminUsersResult {
  items: AdminUserListItemDto[];
  total: number;
}

export async function listAdminUsers(
  input: ListAdminUsersInput,
  ctx: AppContext
): Promise<ListAdminUsersResult> {
  const { prisma } = ctx;

  const page = input.page || 1;
  const limit = input.limit || 50;
  const skip = (page - 1) * limit;

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
      orderBy: { [input.orderBy || 'createdAt']: input.order || 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where })
  ]);

  return {
    items: users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        username: u.username,
        role: u.role,
        isPatron: u.isPatron,
        isDeleted: u.isDeleted,
        patronSince: u.patronSince,
        patronSource: u.patronSource,
        language: u.language,
        createdAt: u.createdAt
    })),
    total
  };
}
