/**
 * A small in-memory stand-in for the Prisma tables the payment flow touches (Payment, StripeEvent,
 * PatronGrant, User, UserPaymentTotal). It implements only the query shapes the code uses, with
 * real filtering, so tests assert behaviour (resulting rows) rather than mocked call arguments.
 */
import { Prisma } from '@prisma/client';

type Row = Record<string, any>;

function matchValue(value: any, cond: any): boolean {
  if (cond === undefined) return true;
  if (cond === null) return value === null || value === undefined;
  if (cond instanceof Date) return value instanceof Date && value.getTime() === cond.getTime();
  if (typeof cond === 'object' && !Array.isArray(cond)) {
    if ('in' in cond) return cond.in.includes(value);
    if ('not' in cond) return cond.not === null ? value !== null && value !== undefined : value !== cond.not;
    if ('lt' in cond || 'gt' in cond) {
      if ('lt' in cond && !(value < cond.lt)) return false;
      if ('gt' in cond && !(value > cond.gt)) return false;
      return true;
    }
  }
  return value === cond;
}

export function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'AND') return (cond as Row[]).every((c) => matches(row, c));
    if (key === 'OR') return (cond as Row[]).some((c) => matches(row, c));
    return matchValue(row[key], cond);
  });
}

function applyData(row: Row, data: Row) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && 'increment' in value) row[key] = (row[key] ?? 0) + value.increment;
    else if (value !== undefined) row[key] = value;
  }
  row.updatedAt = new Date();
}

function uniqueError(target: string[]) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target },
  });
}

let seq = 0;
const id = (prefix: string) => `${prefix}_${++seq}`;

function table(rows: Row[], options: { prefix: string; unique?: string[][] } ) {
  const sortBy = (list: Row[], orderBy?: Row) => {
    if (!orderBy) return list;
    const [[key, dir]] = Object.entries(orderBy);
    return [...list].sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (dir === 'desc' ? -1 : 1));
  };
  return {
    rows,
    async findUnique({ where }: { where: Row }) {
      return rows.find((row) => matches(row, where)) ?? null;
    },
    async findFirst({ where, orderBy }: { where?: Row; orderBy?: Row } = {}) {
      return sortBy(rows.filter((row) => matches(row, where)), orderBy)[0] ?? null;
    },
    async findMany({ where, orderBy, take }: { where?: Row; orderBy?: Row; take?: number } = {}) {
      const list = sortBy(rows.filter((row) => matches(row, where)), orderBy);
      return take ? list.slice(0, take) : list;
    },
    async create({ data }: { data: Row }) {
      for (const keys of options.unique ?? []) {
        if (keys.every((k) => data[k] !== undefined && data[k] !== null) && rows.some((row) => keys.every((k) => row[k] === data[k]))) {
          throw uniqueError(keys);
        }
      }
      const row = { id: id(options.prefix), createdAt: new Date(), updatedAt: new Date(), ...data };
      rows.push(row);
      return row;
    },
    async update({ where, data }: { where: Row; data: Row }) {
      const row = rows.find((r) => matches(r, where));
      if (!row) throw new Error('Record to update not found');
      applyData(row, data);
      return row;
    },
    async updateMany({ where, data }: { where: Row; data: Row }) {
      const hit = rows.filter((row) => matches(row, where));
      hit.forEach((row) => applyData(row, data));
      return { count: hit.length };
    },
    async upsert({ where, create, update }: { where: Row; create: Row; update: Row }) {
      const flat = Object.values(where)[0] as Row;
      const row = rows.find((r) => matches(r, typeof flat === 'object' ? flat : where));
      if (row) {
        applyData(row, update);
        return row;
      }
      return this.create({ data: create });
    },
  };
}

export function createFakePaymentsDb() {
  const db: any = {
    payment: table([], { prefix: 'pay', unique: [['userId', 'requestId'], ['stripeIntentId']] }),
    stripeEvent: table([], { prefix: 'evt', unique: [['id']] }),
    patronGrant: table([], { prefix: 'grant', unique: [['paymentId']] }),
    user: table([], { prefix: 'user' }),
    userPaymentTotal: table([], { prefix: 'upt' }),
    paymentCurrencySetting: table([], { prefix: 'pcs' }),
    async $executeRaw() {
      return 1;
    },
    // SELECT ... FOR UPDATE row lock: nothing to do in a single-threaded in-memory fake.
    async $queryRaw() {
      return [];
    },
    async $transaction(fn: (tx: any) => Promise<any>) {
      return fn(db);
    },
  };
  // StripeEvent rows carry their own Stripe id.
  const createEvent = db.stripeEvent.create.bind(db.stripeEvent);
  db.stripeEvent.create = async ({ data }: { data: Row }) => {
    if (db.stripeEvent.rows.some((row: Row) => row.id === data.id)) throw uniqueError(['id']);
    return createEvent({ data });
  };
  // user.findUnique({ include: { paymentTotals } }) used by the patron read model.
  const findUser = db.user.findUnique.bind(db.user);
  db.user.findUnique = async (args: { where: Row; include?: Row }) => {
    const user = await findUser(args);
    if (!user) return null;
    return { ...user, paymentTotals: db.userPaymentTotal.rows.filter((row: Row) => row.userId === user.id) };
  };
  return db;
}

export function createTestContext(db: any, actor: any = { type: 'system', reason: 'test' }) {
  return {
    prisma: db,
    actor,
    now: () => new Date(),
    db: {
      read: db,
      writeTransaction: (fn: (tx: any) => Promise<any>) => db.$transaction(fn),
    },
  } as any;
}
