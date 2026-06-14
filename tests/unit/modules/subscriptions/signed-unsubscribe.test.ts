import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { buildContentUnsubscribeUrl, CONTENT_UNSUBSCRIBE_PURPOSE, createContentUnsubscribeToken, verifyContentUnsubscribeToken } from '@/lib/modules/subscriptions/domain/signed-unsubscribe-token';
import { SignedContentUnsubscribeUseCase } from '@/lib/modules/subscriptions/application/signed-unsubscribe.use-case';
import { POST } from '@/app/api/subscriptions/unsubscribe/route';
import { EmailPolicy } from '@/lib/modules/email/domain/email.policy';

vi.mock('@/lib/feature-flags', () => ({ flags: { mainCreatorSlug: 'polutek' } }));

const ORIGINAL_ENV = { ...process.env };
const SECRET = 'a'.repeat(32);

type PreferenceRow = {
  id: string;
  userId: string | null;
  email: string;
  marketingEmails: boolean;
  systemEmails: boolean;
  unsubscribedAt: Date | null;
};

function makeDb(options: { preferences?: PreferenceRow[]; userEmail?: string; failPreferenceUpdate?: boolean; p2002OnFirstUpdate?: boolean } = {}) {
  const preferences: PreferenceRow[] = options.preferences ? options.preferences.map((p) => ({ ...p })) : [];
  let p2002Thrown = false;

  const findPreference = vi.fn(async ({ where }: any) => {
    if (where.userId) return preferences.find((p) => p.userId === where.userId) ?? null;
    if (where.email) return preferences.find((p) => p.email === where.email) ?? null;
    if (where.id) return preferences.find((p) => p.id === where.id) ?? null;
    return null;
  });

  const updatePreference = vi.fn(async ({ where, data, select }: any) => {
    if (options.failPreferenceUpdate) throw new Error('preference persistence failed');
    if (options.p2002OnFirstUpdate && !p2002Thrown) {
      p2002Thrown = true;
      throw { code: 'P2002' };
    }
    const row = preferences.find((p) => p.id === where.id);
    if (!row) throw new Error('missing preference row');
    Object.assign(row, data);
    return select?.id ? { id: row.id } : { ...row };
  });

  const createPreference = vi.fn(async ({ data, select }: any) => {
    if (preferences.some((p) => p.userId && p.userId === data.userId) || preferences.some((p) => p.email === data.email)) {
      throw { code: 'P2002' };
    }
    const row = { id: `pref_${preferences.length + 1}`, unsubscribedAt: null, ...data };
    preferences.push(row);
    return select?.id ? { id: row.id } : { ...row };
  });

  const tx = {
    user: { findUnique: vi.fn().mockResolvedValue({ id: 'user_opaque_1', email: options.userEmail ?? 'person@example.com' }) },
    creator: { findUnique: vi.fn().mockResolvedValue({ id: 'creator_1' }) },
    subscription: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue({ id: 'sub_1' }),
    },
    emailPreference: {
      upsert: vi.fn(),
      findUnique: findPreference,
      update: updatePreference,
      create: createPreference,
    },
    patronGrant: { update: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
  };
  const db = {
    ...tx,
    $transaction: vi.fn(async (fn) => fn(tx)),
  };
  return { db, tx, preferences };
}

function makeCtx(db: any, now = new Date('2026-06-14T00:00:00Z')) {
  return {
    prisma: db,
    actor: { type: 'guest' as const },
    now: () => now,
    db: { read: db, writeTransaction: async (fn: any) => db.$transaction(fn) },
  };
}

describe('signed content unsubscribe flow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV, EMAIL_UNSUBSCRIBE_SIGNING_SECRET: SECRET, NEXT_PUBLIC_APP_URL: 'https://polutek.example' };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('valid token can render the GET confirmation flow without database or mutation calls', async () => {
    const token = createContentUnsubscribeToken('user_opaque_1', { now: new Date('2026-06-14T00:00:00Z') })!;
    const pageSource = await import('node:fs/promises').then(fs => fs.readFile('app/unsubscribe/page.tsx', 'utf8'));
    expect(pageSource).toContain('method="post"');
    expect(pageSource).toContain('name="token"');
    expect(verifyContentUnsubscribeToken(token, { now: new Date('2026-06-14T00:00:01Z') }).ok).toBe(true);
  });

  it('multiple GET requests remain state-neutral for Subscription and EmailPreference', async () => {
    const token = createContentUnsubscribeToken('user_opaque_1')!;
    const { tx } = makeDb();
    const pageSource = await import('node:fs/promises').then(fs => fs.readFile('app/unsubscribe/page.tsx', 'utf8'));
    expect(pageSource).not.toContain('SignedContentUnsubscribeUseCase');
    expect(token).toBeTruthy();
    expect(tx.subscription.deleteMany).not.toHaveBeenCalled();
    expect(tx.emailPreference.upsert).not.toHaveBeenCalled();
  });

  it('valid POST deletes main-creator Subscription and creates a missing preference as opted out in the same transaction', async () => {
    const { db, tx, preferences } = makeDb();
    const ctx = makeCtx(db);
    const token = createContentUnsubscribeToken('user_opaque_1', { now: ctx.now() })!;

    await SignedContentUnsubscribeUseCase.execute(ctx as any, token);

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.subscription.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user_opaque_1', creatorId: 'creator_1' } });
    expect(tx.emailPreference.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'user_opaque_1', email: 'person@example.com', marketingEmails: false, systemEmails: true, unsubscribedAt: expect.any(Date) }),
    }));
    expect(tx.emailPreference.upsert).not.toHaveBeenCalled();
    expect(preferences[0]).toEqual(expect.objectContaining({ marketingEmails: false, systemEmails: true, unsubscribedAt: expect.any(Date) }));
    expect(tx.patronGrant.update).not.toHaveBeenCalled();
    expect(tx.patronGrant.deleteMany).not.toHaveBeenCalled();
  });

  it('updates existing EmailPreference by userId instead of direct email upsert and preserves systemEmails=false', async () => {
    const { db, tx, preferences } = makeDb({
      preferences: [{ id: 'pref_user', userId: 'user_opaque_1', email: 'person@example.com', marketingEmails: true, systemEmails: false, unsubscribedAt: null }],
    });
    const token = createContentUnsubscribeToken('user_opaque_1')!;

    await SignedContentUnsubscribeUseCase.execute(makeCtx(db) as any, token);

    expect(tx.emailPreference.findUnique).toHaveBeenCalledWith({ where: { userId: 'user_opaque_1' } });
    expect(tx.emailPreference.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'pref_user' },
      data: expect.objectContaining({ marketingEmails: false, unsubscribedAt: expect.any(Date), email: 'person@example.com' }),
    }));
    expect(tx.emailPreference.create).not.toHaveBeenCalled();
    expect(tx.emailPreference.upsert).not.toHaveBeenCalled();
    expect(preferences).toHaveLength(1);
    expect(preferences[0]).toEqual(expect.objectContaining({ marketingEmails: false, systemEmails: false, unsubscribedAt: expect.any(Date) }));
  });

  it('safely reconciles a userId preference with an old email and preserves systemEmails=true', async () => {
    const { db, tx, preferences } = makeDb({
      preferences: [{ id: 'pref_old', userId: 'user_opaque_1', email: 'old@example.com', marketingEmails: true, systemEmails: true, unsubscribedAt: null }],
    });
    const token = createContentUnsubscribeToken('user_opaque_1')!;

    await SignedContentUnsubscribeUseCase.execute(makeCtx(db) as any, token);

    expect(tx.emailPreference.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'pref_old' },
      data: expect.objectContaining({ email: 'person@example.com', marketingEmails: false, unsubscribedAt: expect.any(Date) }),
    }));
    expect(tx.emailPreference.upsert).not.toHaveBeenCalled();
    expect(preferences[0]).toEqual(expect.objectContaining({ email: 'person@example.com', marketingEmails: false, systemEmails: true, unsubscribedAt: expect.any(Date) }));
  });

  it('uses compatible unowned current-email preference and repeated unsubscribe remains idempotent', async () => {
    const { db, tx, preferences } = makeDb({
      preferences: [{ id: 'pref_email', userId: null, email: 'person@example.com', marketingEmails: false, systemEmails: true, unsubscribedAt: new Date('2026-01-01T00:00:00Z') }],
    });
    const token = createContentUnsubscribeToken('user_opaque_1')!;

    await SignedContentUnsubscribeUseCase.execute(makeCtx(db) as any, token);
    await SignedContentUnsubscribeUseCase.execute(makeCtx(db) as any, token);

    expect(tx.subscription.deleteMany).toHaveBeenCalledTimes(2);
    expect(tx.emailPreference.update).toHaveBeenCalled();
    expect(tx.emailPreference.create).not.toHaveBeenCalled();
    expect(tx.emailPreference.upsert).not.toHaveBeenCalled();
    expect(preferences).toHaveLength(1);
    expect(preferences[0]).toEqual(expect.objectContaining({ userId: 'user_opaque_1', email: 'person@example.com', marketingEmails: false, systemEmails: true, unsubscribedAt: expect.any(Date) }));
  });

  it('repository P2002 retry path prevents a false successful no-op', async () => {
    const { db, tx, preferences } = makeDb({
      p2002OnFirstUpdate: true,
      preferences: [{ id: 'pref_retry', userId: 'user_opaque_1', email: 'person@example.com', marketingEmails: true, systemEmails: true, unsubscribedAt: null }],
    });
    const token = createContentUnsubscribeToken('user_opaque_1')!;

    await SignedContentUnsubscribeUseCase.execute(makeCtx(db) as any, token);

    expect(tx.emailPreference.update).toHaveBeenCalledTimes(2);
    expect(tx.emailPreference.upsert).not.toHaveBeenCalled();
    expect(preferences[0]).toEqual(expect.objectContaining({ marketingEmails: false, unsubscribedAt: expect.any(Date) }));
  });

  it('unexpected preference persistence failure rejects the transaction and still returns generic response', async () => {
    const { db, tx } = makeDb({
      failPreferenceUpdate: true,
      preferences: [{ id: 'pref_fail', userId: 'user_opaque_1', email: 'person@example.com', marketingEmails: true, systemEmails: true, unsubscribedAt: null }],
    });
    const token = createContentUnsubscribeToken('user_opaque_1')!;

    const result = await SignedContentUnsubscribeUseCase.execute(makeCtx(db) as any, token);

    expect(result).toEqual(expect.objectContaining({ ok: true }));
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.subscription.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.emailPreference.update).toHaveBeenCalledTimes(1);
    expect(tx.emailPreference.upsert).not.toHaveBeenCalled();
    expect(tx.emailPreference.create).not.toHaveBeenCalled();
  });

  it('invalid, expired, malformed, tampered, wrong-purpose, unknown recipient, and missing-secret POSTs are generic and safe', async () => {
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const cases = ['invalid', 'malformed.token.value', createContentUnsubscribeToken('user_opaque_1', { now: new Date('2020-01-01T00:00:00Z'), ttlSeconds: 1 })!];
    const valid = createContentUnsubscribeToken('user_opaque_1')!;
    cases.push(`${valid.split('.')[0]}.bad${valid.split('.')[1]}`);
    const wrongPayload = Buffer.from(JSON.stringify({ v: 1, p: 'other-purpose', sub: 'user_opaque_1', exp: 4102444800 })).toString('base64url');
    cases.push(`${wrongPayload}.${valid.split('.')[1]}`);

    for (const token of cases) {
      const { db, tx } = makeDb();
      const result = await SignedContentUnsubscribeUseCase.execute(makeCtx(db) as any, token);
      expect(result).toEqual(expect.objectContaining({ ok: true }));
      expect(tx.subscription.deleteMany).not.toHaveBeenCalled();
      expect(tx.emailPreference.create).not.toHaveBeenCalled();
      expect(tx.emailPreference.update).not.toHaveBeenCalled();
      expect(tx.emailPreference.upsert).not.toHaveBeenCalled();
    }

    const { db, tx } = makeDb();
    tx.user.findUnique.mockResolvedValue(null);
    await SignedContentUnsubscribeUseCase.execute(makeCtx(db) as any, valid);
    expect(tx.emailPreference.create).not.toHaveBeenCalled();
    expect(tx.emailPreference.update).not.toHaveBeenCalled();
    expect(tx.emailPreference.upsert).not.toHaveBeenCalled();

    delete process.env.EMAIL_UNSUBSCRIBE_SIGNING_SECRET;
    const missingSecret = await SignedContentUnsubscribeUseCase.execute(makeCtx(makeDb().db) as any, valid);
    expect(missingSecret).toEqual(expect.objectContaining({ ok: true }));
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('API POST returns generic behavior and invokes the handler once', async () => {
    const spy = vi.spyOn(SignedContentUnsubscribeUseCase, 'execute').mockResolvedValue({ ok: true, message: 'generic' });
    const body = new FormData();
    body.set('token', createContentUnsubscribeToken('user_opaque_1')!);
    const res = await POST(new NextRequest('https://polutek.example/api/subscriptions/unsubscribe', { method: 'POST', body }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, message: 'generic' });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('public URL and decoded token contain no raw or encoded email', () => {
    const url = buildContentUnsubscribeUrl('user_opaque_1', 'https://polutek.example')!;
    const encodedEmail = encodeURIComponent('person@example.com');
    expect(url).toContain('/unsubscribe?token=');
    expect(url).not.toContain('person@example.com');
    expect(url).not.toContain(encodedEmail);
    const token = new URL(url).searchParams.get('token')!;
    const decodedPayload = Buffer.from(token.split('.')[0], 'base64url').toString('utf8');
    expect(decodedPayload).toContain(CONTENT_UNSUBSCRIBE_PURPOSE);
    expect(decodedPayload).toContain('user_opaque_1');
    expect(decodedPayload).not.toContain('person@example.com');
    expect(decodedPayload).not.toContain(encodedEmail);
  });

  it('current recipient selector excludes unsubscribed and missing EmailPreference recipients', async () => {
    const prisma = {
      creator: { findUnique: vi.fn().mockResolvedValue({ id: 'creator_1' }) },
      subscription: { findUnique: vi.fn().mockResolvedValue({ id: 'sub_1' }) },
      emailPreference: { findUnique: vi.fn() },
    };
    prisma.emailPreference.findUnique.mockResolvedValueOnce({ marketingEmails: false });
    await expect(EmailPolicy.canReceiveBroadcastEmail(prisma as any, 'person@example.com', 'user_opaque_1')).resolves.toBe(false);
    prisma.emailPreference.findUnique.mockResolvedValueOnce(null);
    await expect(EmailPolicy.canReceiveBroadcastEmail(prisma as any, 'person@example.com', 'user_opaque_1')).resolves.toBe(false);
    prisma.emailPreference.findUnique.mockResolvedValueOnce({ marketingEmails: true });
    await expect(EmailPolicy.canReceiveBroadcastEmail(prisma as any, 'person@example.com', 'user_opaque_1')).resolves.toBe(true);
  });

  it('registration, tipping and PatronGrant do not create content consent in the signed unsubscribe flow', async () => {
    const { db, tx } = makeDb();
    const token = createContentUnsubscribeToken('user_opaque_1')!;
    await SignedContentUnsubscribeUseCase.execute(makeCtx(db) as any, token);
    expect(tx.emailPreference.create).toHaveBeenCalledTimes(1);
    expect(tx.emailPreference.create).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ marketingEmails: true }) }));
    expect(tx.emailPreference.upsert).not.toHaveBeenCalled();
    expect(tx.patronGrant.findMany).not.toHaveBeenCalled();
  });
});
