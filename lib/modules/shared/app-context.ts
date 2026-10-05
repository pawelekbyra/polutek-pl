import { prisma as defaultPrisma } from '@/lib/prisma';
import { DbClient, ReadDb, WriteTx } from './db';
import { Actor } from './actor';

export interface AppContext {
  prisma: DbClient;
  actor: Actor;
  now: () => Date;
  requestId?: string;
  /** Network facts of the caller (admin panel requests only); recordAuditEvent copies them onto the audit row. */
  client?: { ip?: string | null; userAgent?: string | null };
  /** Admin panel TRANSLATOR accounts only: the translation languages this actor may write. Absent = no restriction (owner). */
  allowedLanguages?: readonly string[];
  waitUntil?: (promise: Promise<unknown>) => void;
  db: {
    read: ReadDb;
    writeTransaction: <T>(fn: (tx: WriteTx) => Promise<T>) => Promise<T>;
  };
}

export function createAppContext(actorOrOverrides: Actor | Partial<AppContext> = {}): AppContext {
  let actor: Actor;
  let prisma: DbClient;
  let now: () => Date;
  let requestId: string | undefined;
  let client: AppContext['client'];
  let allowedLanguages: AppContext['allowedLanguages'];
  let waitUntil: ((promise: Promise<unknown>) => void) | undefined;

  if ('type' in actorOrOverrides) {
    actor = actorOrOverrides as Actor;
    prisma = defaultPrisma;
    now = () => new Date();
  } else {
    const overrides = actorOrOverrides as Partial<AppContext>;
    actor = overrides.actor || { type: 'guest' };
    prisma = overrides.prisma || defaultPrisma;
    now = overrides.now || (() => new Date());
    requestId = overrides.requestId;
    client = overrides.client;
    allowedLanguages = overrides.allowedLanguages;
    waitUntil = overrides.waitUntil;
  }

  return {
    prisma,
    actor,
    now,
    requestId,
    client,
    allowedLanguages,
    waitUntil,
    db: {
      read: prisma,
      writeTransaction: async (fn) => {
        if (prisma && '$transaction' in prisma) {
          return await (prisma as any).$transaction(fn);
        }
        return await fn(prisma as WriteTx);
      }
    }
  };
}
