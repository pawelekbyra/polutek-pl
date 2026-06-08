import { prisma as defaultPrisma } from '@/lib/prisma';
import { DbClient } from './db';
import { Actor } from './actor';

export interface AppContext {
  prisma: DbClient;
  actor: Actor;
  now: () => Date;
  requestId?: string;
}

export function createAppContext(overrides: Partial<AppContext> = {}): AppContext {
  return {
    prisma: defaultPrisma,
    actor: { type: 'guest' },
    now: () => new Date(),
    ...overrides,
  };
}
