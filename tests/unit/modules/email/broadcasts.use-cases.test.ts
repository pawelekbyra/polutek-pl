import { beforeEach, describe, expect, it, vi } from 'vitest';

const { emailsSend } = vi.hoisted(() => ({ emailsSend: vi.fn() }));

vi.mock('nodemailer', () => ({ default: { createTransport: vi.fn(() => ({ sendMail: emailsSend, close: vi.fn() })) } }));
vi.mock('@/lib/feature-flags', () => ({ flags: { mainCreatorSlug: 'polutek' } }));

import { createAppContext } from '@/lib/modules/shared/app-context';
import { cancelBroadcast, countBroadcastAudience, createBroadcast, sendBroadcastTest } from '@/lib/modules/email';

type User = { id: string; email: string; name: string | null; language: string; isDeleted: boolean; subscribed: boolean; consent: boolean | null };

function makeDb(users: User[], options: { suppressed?: string[]; existingByKey?: { id: string; recipientCount: number }; active?: boolean } = {}) {
  const created: any[] = [];
  const recipients: any[] = [];
  const db: any = {
    creator: { findUnique: vi.fn(async () => ({ id: 'creator_1' })) },
    user: {
      findMany: vi.fn(async ({ where }: any) =>
        users
          .filter((u) => !u.isDeleted && u.subscribed && (!where.id || where.id.in.includes(u.id)))
          .map(({ id, email, name, language }) => ({ id, email, name, language }))),
      findUnique: vi.fn(async ({ where }: any) => users.find((u) => u.id === where.id) ?? null),
    },
    emailPreference: {
      findMany: vi.fn(async ({ where }: any) =>
        users.filter((u) => where.userId.in.includes(u.id) && u.consent === true).map((u) => ({ userId: u.id }))),
    },
    emailSuppression: {
      findMany: vi.fn(async ({ where }: any) => {
        const wanted = where.email.in.map((e: string) => e.toLowerCase());
        return (options.suppressed ?? []).filter((e) => wanted.includes(e.toLowerCase())).map((email) => ({ email }));
      }),
    },
    broadcastEmail: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.requestKey) return options.existingByKey ?? null;
        return created.find((b) => b.id === where.id) ?? null;
      }),
      findFirst: vi.fn(async () => (options.active ? { id: 'busy' } : null)),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `b${created.length + 1}`, ...data };
        created.push(row);
        return { id: row.id };
      }),
      update: vi.fn(async ({ where, data }: any) => Object.assign(created.find((b) => b.id === where.id), data)),
    },
    broadcastEmailRecipient: {
      createMany: vi.fn(async ({ data }: any) => { recipients.push(...data); return { count: data.length }; }),
      updateMany: vi.fn(async ({ data }: any) => {
        let count = 0;
        for (const r of recipients) if (r.status === 'PENDING') { Object.assign(r, data); count++; }
        return { count };
      }),
    },
    auditLog: { create: vi.fn() },
  };
  db.$transaction = vi.fn(async (fn: any) => fn(db));
  return { db, created, recipients };
}

const ctxFor = (db: any) => createAppContext({ prisma: db, actor: { type: 'admin', userId: 'admin_1' } });

const user = (id: string, extra: Partial<User> = {}): User => ({
  id, email: `${id}@example.com`, name: `Nick ${id}`, language: 'pl', isDeleted: false, subscribed: true, consent: true, ...extra,
});

const content = { subjectPl: 'Nowy film', htmlPl: '<p>Cześć {{firstName}}</p>' };
const KEY = '6f1c1f9e-6c8c-4d8e-9a59-2f8f1b2b9c11';

describe('broadcast audience', () => {
  it('is only subscribers with consent whose address is not blocked (case-insensitive)', async () => {
    const { db } = makeDb([
      user('ok'),
      user('noconsent', { consent: false }),
      user('nopref', { consent: null }),
      user('notsub', { subscribed: false }),
      user('deleted', { isDeleted: true }),
      user('bounced', { email: 'Bounced@Example.com' }),
    ], { suppressed: ['bounced@example.com'] });
    const result = await countBroadcastAudience(ctxFor(db));
    expect(result.ok && result.data.recipientCount).toBe(1);
  });
});

describe('createBroadcast', () => {
  beforeEach(() => vi.clearAllMocks());

  it('queues the broadcast with its recipients and sends nothing in the request', async () => {
    const { db, created, recipients } = makeDb([user('a'), user('b', { language: 'en' })]);
    const result = await createBroadcast(ctxFor(db), { ...content, requestKey: KEY });
    expect(result.ok && result.data).toEqual({ broadcastId: 'b1', recipientCount: 2, duplicate: false });
    expect(created[0]).toMatchObject({ status: 'READY', requestKey: KEY, recipientGroup: 'SUBSCRIBERS', subjectEn: '', htmlEn: '' });
    expect(recipients.map((r) => [r.userId, r.language, r.status])).toEqual([['a', 'pl', 'PENDING'], ['b', 'en', 'PENDING']]);
    expect(emailsSend).not.toHaveBeenCalled();
    expect(db.auditLog.create).toHaveBeenCalled();
  });

  it('returns the first broadcast when the same request arrives again', async () => {
    const { db, created } = makeDb([user('a')], { existingByKey: { id: 'b-old', recipientCount: 7 } });
    const result = await createBroadcast(ctxFor(db), { ...content, requestKey: KEY });
    expect(result.ok && result.data).toEqual({ broadcastId: 'b-old', recipientCount: 7, duplicate: true });
    expect(created).toHaveLength(0);
  });

  it('refuses a second broadcast while one is still going out', async () => {
    const { db } = makeDb([user('a')], { active: true });
    const result = await createBroadcast(ctxFor(db), { ...content, requestKey: KEY });
    expect(!result.ok && result.error.code).toBe('EMAIL_BROADCAST_IN_PROGRESS');
  });

  it('says clearly when nobody would receive it', async () => {
    const { db } = makeDb([user('a', { consent: false })]);
    const result = await createBroadcast(ctxFor(db), { ...content, requestKey: KEY });
    expect(!result.ok && result.error.code).toBe('EMAIL_NO_RECIPIENTS');
  });

  it('refuses unknown placeholders and a half-filled English version', async () => {
    const { db } = makeDb([user('a')]);
    const unknown = await createBroadcast(ctxFor(db), { subjectPl: 'x', htmlPl: '<p>{{amount}}</p>', requestKey: KEY });
    expect(!unknown.ok && unknown.error.message).toContain('{{amount}}');
    const halfEn = await createBroadcast(ctxFor(db), { ...content, subjectEn: 'New', htmlEn: '', requestKey: KEY });
    expect(halfEn.ok).toBe(false);
  });
});

describe('sendBroadcastTest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SES_SMTP_USER = 'test_user';
    process.env.SES_SMTP_PASS = 'test_pass_1234';
    process.env.EMAIL_UNSUBSCRIBE_SIGNING_SECRET = 'a'.repeat(32);
    process.env.NEXT_PUBLIC_APP_URL = 'https://www.pawelperfect.com';
    emailsSend.mockResolvedValue({ response: '250 Ok email_1', messageId: '<local@x>' });
  });

  it('renders like the real broadcast (footer, one-click header, chosen language) and audits no address', async () => {
    const { db } = makeDb([user('admin_1', { name: 'Paweł' })]);
    const result = await sendBroadcastTest(ctxFor(db), {
      ...content, subjectEn: 'New video', htmlEn: '<p>Hi {{firstName}}</p>', language: 'en',
    });
    expect(result.ok).toBe(true);
    const sent = emailsSend.mock.calls[0][0];
    expect(sent.to).toBe('admin_1@example.com');
    expect(sent.subject).toBe('[TEST] New video');
    expect(sent.html).toContain('Hi Paweł');
    expect(sent.html).toContain('Unsubscribe</a>');
    expect(sent.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(JSON.stringify(db.auditLog.create.mock.calls)).not.toContain('admin_1@example.com');
  });
});

describe('cancelBroadcast', () => {
  it('skips everyone not reached yet', async () => {
    const { db, created, recipients } = makeDb([user('a'), user('b')]);
    await createBroadcast(ctxFor(db), { ...content, requestKey: KEY });
    const result = await cancelBroadcast(ctxFor(db), 'b1');
    expect(result.ok && result.data.skipped).toBe(2);
    expect(created[0].status).toBe('CANCELLED');
    expect(recipients.every((r) => r.status === 'SKIPPED' && r.error === 'CANCELLED')).toBe(true);
  });

  it('refuses a finished broadcast', async () => {
    const { db, created } = makeDb([user('a')]);
    await createBroadcast(ctxFor(db), { ...content, requestKey: KEY });
    created[0].status = 'SENT';
    const result = await cancelBroadcast(ctxFor(db), 'b1');
    expect(!result.ok && result.error.code).toBe('EMAIL_BROADCAST_NOT_ACTIVE');
  });
});
