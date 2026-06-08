import { Prisma, PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '@/lib/prisma';

export type DbClient = PrismaClient | Prisma.TransactionClient;

export interface AppContext {
  prisma: DbClient;
  now: Date;
  requestId?: string;
  userId?: string;
  role?: string;
}

export function createAppContext(overrides: Partial<AppContext> = {}): AppContext {
  return {
    prisma: defaultPrisma,
    now: new Date(),
    ...overrides,
  };
}
