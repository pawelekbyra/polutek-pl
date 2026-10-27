import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import {
  buildContentUnsubscribeUrl,
  buildOneClickUnsubscribeUrl,
  CONTENT_UNSUBSCRIBE_PURPOSE,
  createContentUnsubscribeToken,
  verifyContentUnsubscribeToken,
} from '@/lib/modules/subscriptions/domain/signed-unsubscribe-token';
import { SignedContentUnsubscribeUseCase } from '@/lib/modules/subscriptions/application/signed-unsubscribe.use-case';
import { GET, POST } from '@/app/api/subscriptions/unsubscribe/route';

vi.mock('@/lib/feature-flags', () => ({ flags: {} }));

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

function makeDb(options: { preferences?: PreferenceRow[]; userEmail?: string; language?: string; failPreferenceUpdate?: boolean; p2002OnFirstUpdate?: boolean } = {}) {
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
    $queryRaw: vi.fn().mockResolvedValue([]),
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: 'user_opaque_1', email: options.userEmail ?? 'person@example.com', language: options.language ?? 'pl' }),
    },
    appSetting: { findUnique: vi.fn().mockResolvedValue({ value: 'main-channel-id' }) },
    creator: { findFirst: vi.fn().mockResolvedValue(null), findUnique: vi.fn().mockResolvedValue({ id: 'creator_1' }), update: vi.fn().mockResolvedValue({ id: 'creator_1', subscribersCount: 4 }) },
    subscription: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      count: vi.fn().mockResolvedValue(4),
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

function makeCtx(db: any) {
  return {
    prisma: db,
    actor: { type: 'guest' as const },
    now: () => new Date('2026-10-03T00:00:00Z'),
    db: { read: db, writeTransaction: async (fn: any) => db.$transaction(fn) },
  };
}

describe('unsubscribe token', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, EMAIL_UNSUBSCRIBE_SIGNING_SECRET: SECRET, NEXT_PUBLIC_APP_URL: 'https://www.pawelperfect.com' };
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('never expires: a token from a mail sent long ago still works', () => {
    const token = createContentUnsubscribeToken('user_opaque_1')!;
    const payload = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));
    expect(payload).not.toHaveProperty('exp');
    expect(verifyContentUnsubscribeToken(token)).toEqual({ ok: true, subject: 'user_opaque_1' });
  });

  it('still accepts the old 7-day tokens after their expiry date (they carry exp)', () => {
    const encoded = Buffer.from(JSON.stringify({ v: 1, p: CONTENT_UNSUBSCRIBE_PURPOSE, sub: 'user_opaque_1', exp: 1_700_000_000 })).toString('base64url');
    const legacy = `${encoded}.${createHmac('sha256', SECRET).update(encoded).digest('base64url')}`;
    expect(verifyContentUnsubscribeToken(legacy)).toEqual({ ok: true, subject: 'user_opaque_1' });
  });

  it('keeps links signed with the previous secret working after a rotation', () => {
    const old = createContentUnsubscribeToken('user_opaque_1')!;
    process.env.EMAIL_UNSUBSCRIBE_SIGNING_SECRET = 'b'.repeat(32);
    expect(verifyContentUnsubscribeToken(old).ok).toBe(false);
    process.env.EMAIL_UNSUBSCRIBE_SIGNING_SECRET_PREVIOUS = SECRET;
    expect(verifyContentUnsubscribeToken(old).ok).toBe(true);
  });

  it('rejects tampered, malformed and wrong-purpose tokens', () => {
    const valid = createContentUnsubscribeToken('user_opaque_1')!;
    const wrongPurpose = Buffer.from(JSON.stringify({ v: 1, p: 'other', sub: 'user_opaque_1' })).toString('base64url');
    for (const token of ['invalid', 'a.b.c', `${valid.split('.')[0]}.bad${valid.split('.')[1]}`, `${wrongPurpose}.${valid.split('.')[1]}`]) {
      expect(verifyContentUnsubscribeToken(token).ok).toBe(false);
    }
  });

  it('page and one-click URLs carry no email address', () => {
    const page = buildContentUnsubscribeUrl('user_opaque_1')!;
    const oneClick = buildOneClickUnsubscribeUrl('user_opaque_1')!;
    expect(page).toMatch(/^https:\/\/www\.pawelperfect\.com\/unsubscribe\?token=/);
    expect(oneClick).toMatch(/^https:\/\/www\.pawelperfect\.com\/api\/subscriptions\/unsubscribe\?token=/);
    for (const url of [page, oneClick]) {
      const token = new URL(url).searchParams.get('token')!;
      expect(Buffer.from(token.split('.')[0], 'base64url').toString('utf8')).not.toContain('@');
    }
  });
});

describe('SignedContentUnsubscribeUseCase', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV, EMAIL_UNSUBSCRIBE_SIGNING_SECRET: SECRET, NEXT_PUBLIC_APP_URL: 'https://www.pawelperfect.com' };
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('removes the subscription, records the opt-out and fixes the subscriber count in one transaction', async () => {
    const { db, tx, preferences } = makeDb({ language: 'en' });
    const result = await SignedContentUnsubscribeUseCase.execute(makeCtx(db) as any, createContentUnsubscribeToken('user_opaque_1'));

    expect(result).toEqual({ status: 'unsubscribed', language: 'en' });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.subscription.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user_opaque_1', creatorId: 'creator_1' } });
    expect(tx.creator.update).toHaveBeenCalledWith({ where: { id: 'creator_1' }, data: { subscribersCount: 4 } });
    expect(preferences[0]).toEqual(expect.objectContaining({ userId: 'user_opaque_1', marketingEmails: false, systemEmails: true, unsubscribedAt: expect.any(Date) }));
    expect(tx.patronGrant.update).not.toHaveBeenCalled();
  });

  it('does not touch the count when there was no subscription, and is idempotent', async () => {
    const { db, tx, preferences } = makeDb({
      preferences: [{ id: 'pref_email', userId: null, email: 'person@example.com', marketingEmails: false, systemEmails: true, unsubscribedAt: null }],
    });
    tx.subscription.deleteMany.mockResolvedValue({ count: 0 });
    const token = createContentUnsubscribeToken('user_opaque_1');
    await SignedContentUnsubscribeUseCase.execute(makeCtx(db) as any, token);
    await SignedContentUnsubscribeUseCase.execute(makeCtx(db) as any, token);
    expect(tx.creator.update).not.toHaveBeenCalled();
    expect(preferences).toHaveLength(1);
    expect(preferences[0]).toEqual(expect.objectContaining({ userId: 'user_opaque_1', marketingEmails: false }));
  });

  it('updates the preference found by user id and keeps systemEmails as it was', async () => {
    const { db, preferences } = makeDb({
      preferences: [{ id: 'pref_user', userId: 'user_opaque_1', email: 'old@example.com', marketingEmails: true, systemEmails: false, unsubscribedAt: null }],
    });
    await SignedContentUnsubscribeUseCase.execute(makeCtx(db) as any, createContentUnsubscribeToken('user_opaque_1'));
    expect(preferences[0]).toEqual(expect.objectContaining({ email: 'person@example.com', marketingEmails: false, systemEmails: false }));
  });

  it('survives the P2002 retry path of the preference repository', async () => {
    const { db, tx, preferences } = makeDb({
      p2002OnFirstUpdate: true,
      preferences: [{ id: 'pref_retry', userId: 'user_opaque_1', email: 'person@example.com', marketingEmails: true, systemEmails: true, unsubscribedAt: null }],
    });
    await SignedContentUnsubscribeUseCase.execute(makeCtx(db) as any, createContentUnsubscribeToken('user_opaque_1'));
    expect(tx.emailPreference.update).toHaveBeenCalledTimes(2);
    expect(preferences[0].marketingEmails).toBe(false);
  });

  it('reports a link it did not sign as invalid and changes nothing', async () => {
    const { db, tx } = makeDb();
    const result = await SignedContentUnsubscribeUseCase.execute(makeCtx(db) as any, 'garbage.token');
    expect(result).toEqual({ status: 'invalid', language: null });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(tx.subscription.deleteMany).not.toHaveBeenCalled();
  });

  it('lets a database failure surface (the route shows an error and the mailbox provider retries)', async () => {
    const { db } = makeDb({
      failPreferenceUpdate: true,
      preferences: [{ id: 'p', userId: 'user_opaque_1', email: 'person@example.com', marketingEmails: true, systemEmails: true, unsubscribedAt: null }],
    });
    await expect(SignedContentUnsubscribeUseCase.execute(makeCtx(db) as any, createContentUnsubscribeToken('user_opaque_1'))).rejects.toThrow();
  });

  it('inspect() reads the owner language without changing anything', async () => {
    const { db, tx } = makeDb();
    (db as any).user.findUnique = vi.fn().mockResolvedValue({ language: 'en' });
    const inspected = await SignedContentUnsubscribeUseCase.inspect(makeCtx(db) as any, createContentUnsubscribeToken('user_opaque_1'));
    expect(inspected).toEqual({ valid: true, language: 'en' });
    expect(tx.subscription.deleteMany).not.toHaveBeenCalled();
    expect(await SignedContentUnsubscribeUseCase.inspect(makeCtx(db) as any, 'nope')).toEqual({ valid: false, language: null });
  });
});

describe('/api/subscriptions/unsubscribe', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV, EMAIL_UNSUBSCRIBE_SIGNING_SECRET: SECRET, NEXT_PUBLIC_APP_URL: 'https://www.pawelperfect.com' };
  });
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('handles an RFC 8058 one-click POST (token in the URL, List-Unsubscribe=One-Click body) with 200 and no redirect', async () => {
    const spy = vi.spyOn(SignedContentUnsubscribeUseCase, 'execute').mockResolvedValue({ status: 'unsubscribed', language: 'pl' });
    const url = buildOneClickUnsubscribeUrl('user_opaque_1')!;
    const res = await POST(new NextRequest(url, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'List-Unsubscribe=One-Click',
    }));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
    expect(spy).toHaveBeenCalledWith(expect.anything(), new URL(url).searchParams.get('token'));
  });

  it('sends the form POST from the page back to the page with the result in the person language', async () => {
    vi.spyOn(SignedContentUnsubscribeUseCase, 'execute').mockResolvedValue({ status: 'unsubscribed', language: 'en' });
    const body = new FormData();
    body.set('token', createContentUnsubscribeToken('user_opaque_1')!);
    const res = await POST(new NextRequest('https://www.pawelperfect.com/api/subscriptions/unsubscribe', { method: 'POST', body }));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://www.pawelperfect.com/unsubscribe?status=done&lang=en');
  });

  it('sends a bad link to the page that explains it', async () => {
    const body = new FormData();
    body.set('token', 'garbage');
    const res = await POST(new NextRequest('https://www.pawelperfect.com/api/subscriptions/unsubscribe', { method: 'POST', body }));
    expect(res.headers.get('location')).toBe('https://www.pawelperfect.com/unsubscribe?status=invalid');
  });

  it('never unsubscribes on GET (link scanners): it redirects to the confirmation page', async () => {
    const spy = vi.spyOn(SignedContentUnsubscribeUseCase, 'execute');
    const res = await GET(new NextRequest('https://www.pawelperfect.com/api/subscriptions/unsubscribe?token=abc'));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://www.pawelperfect.com/unsubscribe?token=abc');
    expect(spy).not.toHaveBeenCalled();
  });

  it('answers 500 to a one-click POST when the database fails, so the provider retries', async () => {
    vi.spyOn(SignedContentUnsubscribeUseCase, 'execute').mockRejectedValue(new Error('db down'));
    const res = await POST(new NextRequest(buildOneClickUnsubscribeUrl('user_opaque_1')!, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'List-Unsubscribe=One-Click',
    }));
    expect(res.status).toBe(500);
  });
});
