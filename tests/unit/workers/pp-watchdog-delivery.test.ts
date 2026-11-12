import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '@/workers/pp-watchdog/worker.mjs';

type Row = Record<string, any>;

class FakeD1 {
  states = new Map<string, Row>();
  deliveries = new Map<string, Row>();
  days = new Map<string, number>();
  ping: Row | null = null;
  failAcceptanceBatchOnce = false;

  prepare(sql: string) {
    const query = sql.replace(/\s+/g, ' ').trim();
    let args: any[] = [];
    const statement = {
      sql: query,
      get testArgs() { return args; },
      bind: (...values: any[]) => { args = values; return statement; },
      first: async () => {
        if (query.startsWith('SELECT at, status, warn_since FROM ping')) return this.ping;
        if (query.startsWith('SELECT sent FROM alert_day')) {
          const sent = this.days.get(args[0]);
          return sent === undefined ? null : { sent };
        }
        if (query.startsWith('SELECT * FROM check_state WHERE name')) return this.states.get(args[0]) ?? null;
        if (query.startsWith('UPDATE alert_delivery SET lease_until')) {
          const row = this.deliveries.get(args[1]);
          if (!row || row.status !== 'PENDING' || row.retry_at > args[2] || (row.lease_until && row.lease_until > args[3])) return null;
          row.lease_until = args[0];
          return { ...row };
        }
        throw new Error(`Unexpected D1 first: ${query}`);
      },
      all: async () => {
        if (query.startsWith('SELECT * FROM alert_delivery')) {
          return { results: [...this.deliveries.values()]
            .filter((row) => row.status === 'PENDING' && row.retry_at <= args[0] && (!row.lease_until || row.lease_until <= args[1]))
            .sort((a, b) => a.created_at - b.created_at || a.id.localeCompare(b.id)).slice(0, args[2]).map((row) => ({ ...row })) };
        }
        throw new Error(`Unexpected D1 all: ${query}`);
      },
      run: async () => {
        if (query.startsWith('INSERT INTO alert_delivery')) {
          const [id, check_name, kind, subject, body, created_at, retry_at] = args;
          if (!this.deliveries.has(id)) this.deliveries.set(id, { id, check_name, kind, subject, body, status: 'PENDING', attempts: 0, created_at, retry_at, lease_until: null, sent_at: null, last_error: null });
        } else if (query.startsWith('INSERT INTO check_state')) {
          const [name, ok, fails, since, last_alert, detail, checked_at] = args;
          this.states.set(name, { name, ok, fails, since, last_alert, detail, checked_at });
        } else if (query.startsWith('INSERT INTO alert_day')) {
          this.days.set(args[0], (this.days.get(args[0]) ?? 0) + 1);
        } else if (query.startsWith('UPDATE alert_delivery SET status')) {
          const row = this.deliveries.get(args[1]);
          if (row?.status === 'PENDING') Object.assign(row, { status: 'SENT', sent_at: args[0], lease_until: null, last_error: null });
        } else if (query.startsWith('UPDATE alert_delivery SET attempts')) {
          const row = this.deliveries.get(args[3]);
          if (row?.status === 'PENDING') Object.assign(row, { attempts: args[0], retry_at: args[1], lease_until: null, last_error: args[2] });
        } else if (query.startsWith('DELETE FROM alert_day')) {
          for (const day of this.days.keys()) if (day < args[0]) this.days.delete(day);
        } else {
          throw new Error(`Unexpected D1 run: ${query}`);
        }
        return { success: true };
      },
    };
    return statement;
  }

  async batch(statements: Array<{ sql: string }>) {
    if (statements.every((statement) => statement.sql.startsWith('CREATE TABLE IF NOT EXISTS'))) {
      return statements.map(() => ({ success: true }));
    }
    if (this.failAcceptanceBatchOnce) {
      this.failAcceptanceBatchOnce = false;
      throw new Error('synthetic D1 batch failure');
    }
    expect(statements.map((statement) => statement.sql)).toHaveLength(3);
    const [markSent, incrementDay] = statements;
    expect(markSent.sql).toContain("status = 'SENT'");
    expect(incrementDay.sql).toContain('INSERT INTO alert_day');
    for (const statement of statements) {
      const sql = statement.sql.replace(/\s+/g, ' ').trim();
      if (sql.startsWith('UPDATE alert_delivery SET status')) {
        const [sent_at, id] = (statement as any).testArgs ?? [];
        const row = this.deliveries.get(id);
        if (row?.status === 'PENDING') Object.assign(row, { status: 'SENT', sent_at, lease_until: null, last_error: null });
      } else if (sql.startsWith('INSERT INTO alert_day')) {
        const [day] = (statement as any).testArgs ?? [];
        this.days.set(day, (this.days.get(day) ?? 0) + 1);
      } else if (sql.startsWith('DELETE FROM alert_day')) {
        const [before] = (statement as any).testArgs ?? [];
        for (const day of this.days.keys()) if (day < before) this.days.delete(day);
      }
    }
    return statements.map(() => ({ success: true }));
  }
}

const env = (DB: FakeD1) => ({ DB, PING_TOKEN: 'test-token', RESEND_API_KEY: 'synthetic', ALERT_FROM: 'test@example.invalid', ALERT_TO: 'test@example.invalid' });
const run = (DB: FakeD1) => worker.fetch(new Request('https://watchdog.example.invalid/run', { method: 'POST', headers: { authorization: 'Bearer test-token' } }), env(DB));

function mockFetch() {
  const deliveries: Array<{ subject: string; idempotencyKey: string | null }> = [];
  let mailStatus: number | 'throw' = 200;
  let wwwStatus = 200;
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === 'https://www.pawelperfect.com/api/health') return new Response('{}', { status: wwwStatus });
    if (url === 'https://video.pawelperfect.com/') return new Response(null, { status: 404 });
    if (url === 'https://support.pawelperfect.com/') return new Response(null, { status: 302, headers: { location: 'https://example.cloudflareaccess.com/login' } });
    if (url === 'https://api.resend.com/emails') {
      const body = JSON.parse(String(init?.body));
      deliveries.push({ subject: body.subject, idempotencyKey: new Headers(init?.headers).get('idempotency-key') });
      if (mailStatus === 'throw') throw new Error('synthetic provider outage');
      return new Response('{}', { status: mailStatus });
    }
    throw new Error(`Unexpected network request: ${url}`);
  }));
  return { deliveries, setMailStatus: (status: number | 'throw') => { mailStatus = status; }, setWwwStatus: (status: number) => { wwwStatus = status; } };
}

describe('pp-watchdog durable alert delivery', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('retries an HTTP 503 recovery on a later healthy run with a stable idempotency key', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-06T10:00:00Z'));
    const DB = new FakeD1();
    const network = mockFetch();
    network.setWwwStatus(503);
    const deliveries = network.deliveries;
    await run(DB);
    vi.setSystemTime(new Date('2026-11-06T10:01:00Z'));
    await run(DB);
    expect([...DB.deliveries.values()].some((row) => row.status === 'SENT' && row.kind === 'DOWN')).toBe(true);

    network.setWwwStatus(200);
    network.setMailStatus(503);
    vi.setSystemTime(new Date('2026-11-06T10:06:00Z'));
    await run(DB);
    const recovery = [...DB.deliveries.values()].find((row) => row.kind === 'RECOVERY');
    expect(recovery).toMatchObject({ status: 'PENDING', attempts: 1, last_error: 'http-503' });
    expect(DB.states.get('www')?.ok).toBe(1);

    vi.setSystemTime(new Date('2026-11-06T10:11:00Z'));
    network.setMailStatus(200);
    await run(DB);
    expect(DB.deliveries.get(recovery!.id)).toMatchObject({ status: 'SENT', attempts: 1, last_error: null });
    expect(deliveries.filter((item) => item.subject.includes('OK again'))).toHaveLength(2);
    expect(deliveries.filter((item) => item.subject.includes('OK again')).map((item) => item.idempotencyKey)).toEqual([recovery!.id, recovery!.id]);
  });

  it('keeps a recovery pending at the daily cap and delivers it after the UTC quota resets', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-06T23:55:00Z'));
    const DB = new FakeD1();
    const date = new Date(Date.now()).toISOString().slice(0, 10);
    DB.days.set(date, 20);
    DB.states.set('www', { name: 'www', ok: 0, fails: 2, since: Date.now() - 10_000, last_alert: Date.now() - 1_000, detail: 'HTTP 503', checked_at: Date.now() - 1_000 });
    mockFetch();
    await run(DB);
    const recovery = [...DB.deliveries.values()].find((row) => row.kind === 'RECOVERY');
    expect(recovery).toMatchObject({ status: 'PENDING', attempts: 1, last_error: 'daily-limit' });
    expect(DB.states.get('www')?.ok).toBe(1);

    vi.setSystemTime(new Date('2026-11-07T00:00:00Z'));
    mockFetch();
    await run(DB);
    expect(DB.deliveries.get(recovery!.id)).toMatchObject({ status: 'SENT', attempts: 1 });
  });

  it('claims one pending event across overlapping runs and uses a provider idempotency key', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-07T01:00:00Z'));
    const DB = new FakeD1();
    const id = 'heartbeat:1730930000000:recovery';
    DB.deliveries.set(id, { id, check_name: 'heartbeat', kind: 'RECOVERY', subject: '[pp-watchdog] OK again: heartbeat', body: 'recovered', status: 'PENDING', attempts: 2, created_at: Date.now() - 60_000, retry_at: Date.now(), lease_until: null, sent_at: null, last_error: 'http-503' });
    const network = mockFetch();

    await Promise.all([run(DB), run(DB)]);

    expect(network.deliveries).toHaveLength(1);
    expect(network.deliveries[0]).toEqual({ subject: '[pp-watchdog] OK again: heartbeat', idempotencyKey: id });
    expect(DB.deliveries.get(id)).toMatchObject({ status: 'SENT', attempts: 2 });
  });

  it('retains a pending event after a thrown provider request and retries it later', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-07T02:00:00Z'));
    const DB = new FakeD1();
    const id = 'www:1730930000000:recovery';
    DB.deliveries.set(id, { id, check_name: 'www', kind: 'RECOVERY', subject: '[pp-watchdog] OK again: www', body: 'recovered', status: 'PENDING', attempts: 0, created_at: Date.now(), retry_at: Date.now(), lease_until: null, sent_at: null, last_error: null });
    const network = mockFetch();
    network.setMailStatus('throw');
    await run(DB);
    expect(DB.deliveries.get(id)).toMatchObject({ status: 'PENDING', attempts: 1, last_error: 'Error' });

    vi.setSystemTime(new Date('2026-11-07T02:05:00Z'));
    network.setMailStatus(200);
    await run(DB);
    expect(DB.deliveries.get(id)).toMatchObject({ status: 'SENT', attempts: 1 });
  });

  it('retries the same idempotent event when provider acceptance cannot be committed to D1', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-07T03:00:00Z'));
    const DB = new FakeD1();
    DB.ping = { at: Date.now(), status: 'OK', warn_since: null };
    const id = 'www:1730930000000:recovery';
    DB.deliveries.set(id, { id, check_name: 'www', kind: 'RECOVERY', subject: '[pp-watchdog] OK again: www', body: 'recovered', status: 'PENDING', attempts: 0, created_at: Date.now(), retry_at: Date.now(), lease_until: null, sent_at: null, last_error: null });
    DB.failAcceptanceBatchOnce = true;
    const network = mockFetch();

    await expect(run(DB)).rejects.toThrow('synthetic D1 batch failure');
    expect(DB.deliveries.get(id)).toMatchObject({ status: 'PENDING', attempts: 0 });
    expect(DB.days.size).toBe(0);
    expect(network.deliveries.map((item) => item.idempotencyKey)).toEqual([id]);

    vi.setSystemTime(new Date('2026-11-07T03:00:31Z'));
    await run(DB);

    expect(DB.deliveries.get(id)).toMatchObject({ status: 'SENT', attempts: 0 });
    expect(DB.days.get('2026-11-07')).toBe(1);
    expect(network.deliveries.map((item) => item.idempotencyKey)).toEqual([id, id]);
  });
});
