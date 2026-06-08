import { prisma as defaultPrisma } from '@/lib/prisma';
import { DbClient } from './db';
import { Actor } from './actor';

export interface AppContext {
  prisma: DbClient;
  actor: Actor;
  now: () => Date;
  requestId?: string;
  /** @deprecated use ctx.actor */
  userId?: string;
  /** @deprecated use ctx.actor */
  role?: string;
}

export function createAppContext(overrides: Partial<AppContext> = {}): AppContext {
  const actor = overrides.actor || { type: 'guest' };

  return {
    prisma: defaultPrisma,
    actor,
    now: () => new Date(),
    userId: actor.type !== 'guest' && 'userId' in actor ? actor.userId : undefined,
    ...overrides,
  };
}
