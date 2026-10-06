import { describe, expect, it } from 'vitest';
import { nextState } from '@/workers/pp-watchdog/worker.mjs';

const MIN = 60_000;
type State = { ok: number; fails: number; since: number; last_alert: number | null };
type Result = { state: State; mail: { subject: string } | null };
const step = (previous: State | null, ok: boolean, now: number): Result =>
  nextState(previous, { name: 'www', ok, detail: ok ? 'HTTP 200' : 'HTTP 502' }, now);

describe('pp-watchdog alert state', () => {
  it('ignores a single failed check, alerts on the second, reminds after 6 h, reports recovery once', () => {
    let r = step(null, true, 0);
    expect(r.mail).toBeNull();
    r = step(r.state, false, 5 * MIN);
    expect(r.mail).toBeNull();
    r = step(r.state, false, 10 * MIN);
    expect(r.mail?.subject).toBe('[pp-watchdog] DOWN: www');
    r = step(r.state, false, 15 * MIN);
    expect(r.mail).toBeNull();
    r = step(r.state, false, 10 * MIN + 6 * 60 * MIN);
    expect(r.mail?.subject).toBe('[pp-watchdog] DOWN: www');
    r = step(r.state, true, 7 * 60 * MIN);
    expect(r.mail?.subject).toBe('[pp-watchdog] OK again: www');
    expect(step(r.state, true, 8 * 60 * MIN).mail).toBeNull();
  });

  it('a blip that recovers before the second check sends nothing at all', () => {
    let r = step(null, false, 0);
    r = step(r.state, true, 5 * MIN);
    expect(r.mail).toBeNull();
    expect(r.state.ok).toBe(1);
  });
});

describe('pp-watchdog alert mail (Email Workers send_email, no provider key)', () => {
  it('builds a plain RFC 5322 message with an ASCII subject and a base64 UTF-8 body', async () => {
    const { buildMime } = await import('@/workers/pp-watchdog/worker.mjs');
    const mime = buildMime({ ALERT_FROM: 'pp-watchdog <pp-watchdog@pawelperfect.com>', ALERT_TO: 'owner@example.com' }, '[pp-watchdog] DOWN: www ąę', 'Serwer nie odpowiada: zażółć', 1_700_000_000_000);
    expect(mime).toContain('From: pp-watchdog <pp-watchdog@pawelperfect.com>\r\n');
    expect(mime).toContain('To: owner@example.com\r\n');
    expect(mime).toContain('Subject: [pp-watchdog] DOWN: www ??\r\n');
    expect(mime).toMatch(/Message-ID: <1700000000000\.[a-z0-9]+@pawelperfect\.com>/);
    expect(mime).toContain('Content-Transfer-Encoding: base64');
    const body = mime.split('\r\n\r\n')[1].replace(/\r\n/g, '');
    expect(Buffer.from(body, 'base64').toString('utf8')).toBe('Serwer nie odpowiada: zażółć');
  });
});
