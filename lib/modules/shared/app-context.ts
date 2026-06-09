import { prisma as defaultPrisma } from '@/lib/prisma';
import { DbClient, ReadDb } from './db';
import { Actor } from './actor';

export interface AppContext {
  prisma: DbClient;
  actor: Actor;
  now: () => Date;
  requestId?: string;
}

export function createAppContext(overrides: Partial<AppContext> = {}): AppContext {
  const { userId: _, role: __, ...restOverrides } = overrides as any;
  const actor = overrides.actor || { type: 'guest' };

  return {
    prisma: overrides.prisma || defaultPrisma,
    actor,
    now: overrides.now || (() => new Date()),
    ...restOverrides,
  };
}
