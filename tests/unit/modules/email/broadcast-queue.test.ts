import { describe, expect, it, vi } from 'vitest';
import { processBroadcastQueue, type SendBroadcastMail } from '@/lib/modules/email/application/process-broadcast-queue';
import type { BroadcastQueueStore, ClaimedBroadcast, QueuedRecipient } from '@/lib/modules/email/infrastructure/broadcast-queue.repository';
import { BROADCAST_MAX_ATTEMPTS, BROADCAST_SEND_INTERVAL_MS, classifySendFailure } from '@/lib/modules/email/domain/broadcast-queue.policy';
import { renderBroadcastMessage } from '@/lib/modules/email/domain/broadcast-message';

type Row = QueuedRecipient & { status: string; error?: string; nextAttemptAt?: number; providerId?: string | null };

/** In-memory queue with the same contract as BroadcastQueueRepository. */
function fakeStore(rows: Row[], options: { eligibleUserIds?: string[]; leased?: boolean } = {}) {
  const broadcast = { id: 'b1', subjectPl: 'Nowy film', htmlPl: '<p>Cześć {{firstName}}</p>', subjectEn: '', htmlEn: '' };
  // `owner` models BroadcastEmail.lockedBy: only the run holding the current token may renew, release or finalize.
  const state = { status: 'READY', owner: null as string | null, claims: 0, nextRunAt: null as Date | null, finalized: false };
  let clock = 0;
  const store: BroadcastQueueStore & { state: typeof state; rows: Row[]; tick: (ms: number) => void } = {
    state,
    rows,
    tick: (ms) => { clock += ms; },
    claimNext: vi.fn(async () => {
      if (options.leased) return null;
      if (!['READY', 'SENDING'].includes(state.status)) return null;
      state.status = 'SENDING';
      state.owner = `token-${++state.claims}`;
      return { ...broadcast, leaseToken: state.owner } satisfies ClaimedBroadcast;
    }),
    loadDueRecipients: vi.fn(async (_id, limit) =>
      rows.filter((r) => r.status === 'PENDING' && (r.nextAttemptAt ?? 0) <= clock).slice(0, limit)),
    stillEligible: vi.fn(async (userIds: string[]) => {
      const allowed = options.eligibleUserIds ?? userIds;
      return new Map(userIds.filter((id) => allowed.includes(id)).map((id) => [id, { name: `Nick ${id}` }]));
    }),
    markSent: vi.fn(async (id, providerId) => { Object.assign(rows.find((r) => r.id === id)!, { status: 'SENT', providerId }); }),
    markSkipped: vi.fn(async (id, reason) => { Object.assign(rows.find((r) => r.id === id)!, { status: 'SKIPPED', error: reason }); }),
    markFailed: vi.fn(async (id, reason, attemptCount) => { Object.assign(rows.find((r) => r.id === id)!, { status: 'FAILED', error: reason, attemptCount }); }),
    scheduleRetry: vi.fn(async (id, reason, attemptCount, at) => {
      Object.assign(rows.find((r) => r.id === id)!, { error: reason, attemptCount, nextAttemptAt: at.getTime() });
    }),
    hasPending: vi.fn(async () => rows.some((r) => r.status === 'PENDING')),
    renewLease: vi.fn(async (_id, token) => state.status === 'SENDING' && state.owner === token),
    release: vi.fn(async (_id, token, nextRunAt) => {
      if (state.owner !== token) return;
      state.nextRunAt = nextRunAt;
      state.owner = null;
    }),
    finalize: vi.fn(async (_id, token) => {
      if (state.owner !== token) return;
      state.finalized = true;
      state.status = 'SENT';
      state.owner = null;
    }),
  };
  return { store, now: () => clock };
}

const recipient = (n: number, extra: Partial<Row> = {}): Row => ({
  id: `r${n}`, userId: `u${n}`, email: `p${n}@example.com`, language: 'pl', attemptCount: 0, status: 'PENDING', ...extra,
});

describe('broadcast queue run', () => {
  it('sends every pending recipient once, paced, and finishes the broadcast', async () => {
    const { store, now } = fakeStore([recipient(1), recipient(2), recipient(3)]);
    const send = vi.fn<SendBroadcastMail>(async (_b, r) => ({ ok: true, id: `re_${r.id}` }));
    const sleep = vi.fn(async (ms: number) => store.tick(ms));

    const result = await processBroadcastQueue({ store, send, now, sleep });

    expect(result).toMatchObject({ broadcastId: 'b1', sent: 3, finished: true });
    expect(send).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledWith(BROADCAST_SEND_INTERVAL_MS);
    expect(store.rows.map((r) => r.providerId)).toEqual(['re_r1', 're_r2', 're_r3']);
    expect(store.finalize).toHaveBeenCalledWith('b1', 'token-1');
  });

  it('does nothing when another run holds the broadcast (no double sending)', async () => {
    const { store, now } = fakeStore([recipient(1)], { leased: true });
    const send = vi.fn<SendBroadcastMail>();
    const result = await processBroadcastQueue({ store, send, now, sleep: async () => undefined });
    expect(result.broadcastId).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });

  it('skips a person who unsubscribed or bounced after the broadcast was created', async () => {
    const { store, now } = fakeStore([recipient(1), recipient(2)], { eligibleUserIds: ['u2'] });
    const send = vi.fn<SendBroadcastMail>(async () => ({ ok: true, id: 'x' }));
    const result = await processBroadcastQueue({ store, send, now, sleep: async () => undefined });
    expect(result).toMatchObject({ sent: 1, skipped: 1 });
    expect(store.rows[0]).toMatchObject({ status: 'SKIPPED', error: 'NO_LONGER_ELIGIBLE' });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('stops the run on 429, keeps the recipient pending and delays the broadcast', async () => {
    const { store, now } = fakeStore([recipient(1), recipient(2)]);
    const send = vi.fn<SendBroadcastMail>(async () => ({ ok: false, error: { name: 'rate_limit_exceeded', message: 'Too many requests', statusCode: 429 } }));
    const result = await processBroadcastQueue({ store, send, now, sleep: async () => undefined });
    expect(send).toHaveBeenCalledTimes(1);
    expect(store.rows.every((r) => r.status === 'PENDING' && r.attemptCount === 0)).toBe(true);
    expect(result.pausedUntil).not.toBeNull();
    expect(store.release).toHaveBeenCalledWith('b1', 'token-1', expect.any(Date));
    expect(store.finalize).not.toHaveBeenCalled();
  });

  it('retries a temporary failure later and gives up after the attempt limit', async () => {
    const { store, now } = fakeStore([recipient(1), recipient(2, { attemptCount: BROADCAST_MAX_ATTEMPTS - 1 })]);
    const send = vi.fn<SendBroadcastMail>(async () => ({ ok: false, error: { name: 'application_error', message: 'boom', statusCode: 500 } }));
    const result = await processBroadcastQueue({ store, send, now, sleep: async () => undefined });
    expect(result).toMatchObject({ retried: 1, failed: 1, finished: false });
    expect(store.rows[0]).toMatchObject({ status: 'PENDING', attemptCount: 1 });
    expect(store.rows[0].nextAttemptAt).toBeGreaterThan(0);
    expect(store.rows[1]).toMatchObject({ status: 'FAILED', attemptCount: BROADCAST_MAX_ATTEMPTS });
    expect(store.release).toHaveBeenCalledWith('b1', 'token-1', null);
  });

  it('marks a permanent error FAILED at once', async () => {
    const { store, now } = fakeStore([recipient(1)]);
    const send = vi.fn<SendBroadcastMail>(async () => ({ ok: false, error: { name: 'validation_error', message: 'Invalid `to`', statusCode: 422 } }));
    const result = await processBroadcastQueue({ store, send, now, sleep: async () => undefined });
    expect(result).toMatchObject({ failed: 1, finished: true });
  });

  it('hands over to the next run when the time budget is used, without losing anyone', async () => {
    const { store, now } = fakeStore([recipient(1), recipient(2), recipient(3)]);
    const send = vi.fn<SendBroadcastMail>(async () => ({ ok: true, id: 'x' }));
    const result = await processBroadcastQueue({ store, send, now, sleep: async (ms) => store.tick(ms * 100), budgetMs: 30_000 });
    expect(result.sent).toBe(2);
    expect(result.finished).toBe(false);
    expect(store.rows[2].status).toBe('PENDING');
    expect(store.release).toHaveBeenCalledWith('b1', 'token-1', null);
  });

  it('releases the broadcast when the database fails mid-run, so the next run resumes', async () => {
    const { store, now } = fakeStore([recipient(1)]);
    vi.mocked(store.markSent).mockRejectedValueOnce(new Error('db down'));
    const send = vi.fn<SendBroadcastMail>(async () => ({ ok: true, id: 'x' }));
    await expect(processBroadcastQueue({ store, send, now, sleep: async () => undefined })).rejects.toThrow('db down');
    expect(store.release).toHaveBeenCalledWith('b1', 'token-1', null);
  });
});

describe('broadcast lease ownership', () => {
  it('renews the lease before every send', async () => {
    const { store, now } = fakeStore([recipient(1), recipient(2), recipient(3)]);
    const send = vi.fn<SendBroadcastMail>(async () => ({ ok: true, id: 'x' }));
    await processBroadcastQueue({ store, send, now, sleep: async () => undefined });
    expect(store.renewLease).toHaveBeenCalledTimes(3);
    expect(store.renewLease).toHaveBeenCalledWith('b1', 'token-1', expect.any(Number));
  });

  it('a run whose lease was taken over stops sending and cannot finalize or release the new owner\'s broadcast', async () => {
    const { store, now } = fakeStore([recipient(1), recipient(2), recipient(3)]);
    const send = vi.fn<SendBroadcastMail>(async (_b, r) => {
      // While the first send hangs, the lease runs out and a second run takes the broadcast over.
      if (r.id === 'r1') store.state.owner = 'token-other';
      return { ok: true, id: 'x' };
    });
    const result = await processBroadcastQueue({ store, send, now, sleep: async () => undefined });
    expect(result.leaseLost).toBe(true);
    expect(result.finished).toBe(false);
    expect(send).toHaveBeenCalledTimes(1); // r2 and r3 are left to the new owner
    expect(store.finalize).not.toHaveBeenCalled();
    expect(store.release).not.toHaveBeenCalled();
    expect(store.state.owner).toBe('token-other');
  });

  it('a late finalize or release from the old run is ignored by the store once someone else owns the lease', async () => {
    const { store } = fakeStore([]);
    const first = await store.claimNext(1);
    store.state.status = 'SENDING';
    store.state.owner = 'token-new';
    await store.finalize(first!.id, first!.leaseToken);
    await store.release(first!.id, first!.leaseToken, null);
    expect(store.state.finalized).toBe(false);
    expect(store.state.owner).toBe('token-new');
  });

  it('cuts a hanging send at the timeout and retries that recipient later instead of holding the lease', async () => {
    const { store, now } = fakeStore([recipient(1), recipient(2)]);
    const send = vi.fn<SendBroadcastMail>((_b, r) => (r.id === 'r1' ? new Promise(() => undefined) : Promise.resolve({ ok: true, id: 'x' })));
    const result = await processBroadcastQueue({ store, send, now, sleep: async () => undefined, sendTimeoutMs: 5 });
    expect(result).toMatchObject({ retried: 1, sent: 1 });
    expect(store.rows[0]).toMatchObject({ status: 'PENDING', attemptCount: 1, error: 'send_timeout' });
    expect(store.rows[0].nextAttemptAt).toBeGreaterThan(0);
  });
});

describe('send failure classification', () => {
  it('pauses on rate limit and quota, retries 5xx and network errors, fails 4xx', () => {
    expect(classifySendFailure({ name: 'daily_quota_exceeded', message: 'x', statusCode: 429 }, 1)).toMatchObject({ kind: 'pause', delayMs: 3_600_000 });
    expect(classifySendFailure({ message: 'x', statusCode: 429 }, 1)).toMatchObject({ kind: 'pause', delayMs: 60_000 });
    expect(classifySendFailure({ message: 'socket hang up' }, 1)).toMatchObject({ kind: 'retry' });
    expect(classifySendFailure({ name: 'internal_server_error', message: 'x', statusCode: 500 }, 2)).toMatchObject({ kind: 'retry', delayMs: 120_000 });
    expect(classifySendFailure({ name: 'validation_error', message: 'x', statusCode: 422 }, 1)).toMatchObject({ kind: 'fail' });
  });
});

describe('broadcast message', () => {
  const content = { subjectPl: 'Nowy film dla {{firstName}}', htmlPl: '<p>Cześć {{firstName}}, {{unknown}}</p>', subjectEn: 'New video', htmlEn: '<p>Hi {{firstName}}</p>' };
  const values = {
    language: 'pl' as const,
    nickname: '<b>Jan</b>',
    email: 'jan@example.com',
    appName: 'www.pawelperfect.com',
    brandName: 'Pawel Perfect',
    appUrl: 'https://www.pawelperfect.com',
    unsubscribePageUrl: 'https://www.pawelperfect.com/unsubscribe?token=a&b',
  };

  it('always carries a footer with the unsubscribe link, escapes values and drops unknown placeholders', () => {
    const message = renderBroadcastMessage(content, values);
    expect(message.subject).toBe('Nowy film dla <b>Jan</b>');
    expect(message.html).toBe('<p>Cześć &lt;b&gt;Jan&lt;/b&gt;, </p>');
    expect(message.footerHtml).toContain('href="https://www.pawelperfect.com/unsubscribe?token=a&amp;b"');
    expect(message.footerHtml).toContain('Wypisz się');
  });

  it('uses the English version for an English recipient and falls back to Polish when there is none', () => {
    expect(renderBroadcastMessage(content, { ...values, language: 'en' })).toMatchObject({ language: 'en', subject: 'New video' });
    const plOnly = renderBroadcastMessage({ ...content, subjectEn: '', htmlEn: '' }, { ...values, language: 'en' });
    expect(plOnly.language).toBe('pl');
    expect(plOnly.footerHtml).toContain('Wypisz się');
  });
});
