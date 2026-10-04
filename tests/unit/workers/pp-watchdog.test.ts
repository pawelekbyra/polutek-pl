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
