/** CSV injection, segment filters, export (audit, cap, formula-safe cells), "view as" explanation, device labels. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppContext } from '@/lib/modules/shared/app-context';
import { csvNumber, csvText, deviceLabel, exportUsersCsv, explainAccess, panelUserWhere, toCsv, USERS_EXPORT_MAX_ROWS, viewAsPerson } from '@/lib/modules/admin-community';

const NOW = new Date('2026-10-05T10:00:00.000Z');

describe('csvText (spreadsheet formula injection, OWASP)', () => {
  it.each(['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\t=1', '\r=1', ' =HYPERLINK("x")', ' =1', '\n=1', '＝1', '＋1', '－1', '＠x'])('neutralises %j', (v) => {
    const cell = csvText(v);
    expect(cell.startsWith(`"'`)).toBe(true);
  });
  it('leaves normal text, quotes inner quotes, flattens line breaks, writes empty for null', () => {
    expect(csvText('Kasia')).toBe('"Kasia"');
    expect(csvText('a "b" c')).toBe('"a ""b"" c"');
    expect(csvText('a\nb')).toBe('"a b"');
    expect(csvText(null)).toBe('""');
    expect(csvText('a=b')).toBe('"a=b"');
  });
  it('numbers we compute are never prefixed; non-finite is empty', () => {
    expect(csvNumber(-12.5)).toBe('-12.5');
    expect(csvNumber(NaN)).toBe('');
    expect(csvNumber(undefined)).toBe('');
  });
  it('toCsv adds BOM, CRLF and quotes every text cell', () => {
    const out = toCsv(['A', 'B'], [[{ text: '=evil' }, { number: -1 }]]);
    expect(out).toBe('﻿"A","B"\r\n"\'=evil",-1\r\n');
  });
});

describe('panelUserWhere', () => {
  it('hides deleted accounts unless asked and builds the segments', () => {
    expect(JSON.stringify(panelUserWhere({}, NOW))).toContain('"isDeleted":false');
    expect(JSON.stringify(panelUserWhere({ seg: 'usunieci' }, NOW))).toContain('"isDeleted":true');
    expect(JSON.stringify(panelUserWhere({ seg: 'nowi' }, NOW))).toContain('2026-09-28T10:00:00.000Z');
    expect(JSON.stringify(panelUserWhere({ seg: 'wspierajacy' }, NOW))).toContain('"revokedAt":null');
    expect(JSON.stringify(panelUserWhere({ seg: '2fa' }, NOW))).toContain('passkeys');
    expect(JSON.stringify(panelUserWhere({ q: 'ola' }, NOW))).toContain('"contains":"ola"');
  });
});

describe('exportUsersCsv', () => {
  let prisma: any;
  let audits: any[];
  const ctx = (actor: any = { type: 'admin', userId: 'panel-1' }) => createAppContext({ actor, prisma, now: () => NOW });
  const row = (over: any = {}) => ({ id: 'u1', email: 'a@b.pl', name: '=HYPERLINK("http://evil")', role: 'USER', emailVerified: true, language: 'pl', isDeleted: false, createdAt: new Date('2026-09-01T00:00:00Z'), commentMutedUntil: null, paymentTotals: [{ currency: 'PLN', amountMinor: 2500 }], patronGrants: [{ id: 'g' }], _count: { payments: 1 }, ...over });
  beforeEach(() => {
    audits = [];
    prisma = {
      user: { count: vi.fn(async () => 1), findMany: vi.fn(async () => [row(), row({ id: 'u2', isDeleted: true, email: 'deleted_x@deleted.invalid', name: 'Usunięty' })]) },
      auditLog: { create: vi.fn(async ({ data }: any) => audits.push(data)) },
      $transaction: vi.fn((fn: any) => fn(prisma)),
    };
  });
  it('neutralises hostile nicknames, drops personal data of deleted accounts and audits actor, filters and count', async () => {
    const r = await exportUsersCsv(ctx(), { q: 'a', seg: 'nowi' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(r.data.csv).not.toContain('deleted_x@deleted.invalid');
    expect(r.data.rows).toBe(2);
    expect(r.data.fileName).toBe('uzytkownicy-2026-10-05.csv');
    expect(audits[0]).toMatchObject({ action: 'USERS_EXPORT', actorUserId: 'panel-1', metadata: { filters: { q: 'a', seg: 'nowi' }, count: 2 } });
  });
  it('refuses non-admins (nothing read) and exports above the cap (nothing exported, no audit)', async () => {
    expect(await exportUsersCsv(ctx({ type: 'user', userId: 'u' }), {})).toMatchObject({ ok: false, error: { statusCode: 403 } });
    expect(prisma.user.count).not.toHaveBeenCalled();
    prisma.user.count.mockResolvedValue(USERS_EXPORT_MAX_ROWS + 1);
    expect(await exportUsersCsv(ctx(), {})).toMatchObject({ ok: false, error: { statusCode: 413 } });
    expect(audits).toHaveLength(0);
  });
});

describe('explainAccess and viewAsPerson', () => {
  const subject = { isDeleted: false, emailVerified: true, onboardingPending: false, commentMutedUntil: null, role: 'USER' as const };
  const films = [{ id: 'v1', slug: 'a', title: 'A', tier: 'PUBLIC' as const }, { id: 'v2', slug: 'b', title: 'B', tier: 'LOGGED_IN' as const }, { id: 'v3', slug: 'c', title: 'C', tier: 'PATRON' as const }];
  it('two access levels, a leftover PATRON tier counts as logged-in, a tip unlocks nothing', () => {
    const e = explainAccess(subject, films, NOW);
    expect(e.films.map((f) => [f.tier, f.canWatch])).toEqual([['PUBLIC', true], ['LOGGED_IN', true], ['LOGGED_IN', true]]);
    expect(e.signIn.ok).toBe(true);
    expect(e.commenting.ok).toBe(true);
  });
  it('reflects mute, pending nickname and deleted accounts', () => {
    expect(explainAccess({ ...subject, commentMutedUntil: new Date(NOW.getTime() + 1000) }, [], NOW).commenting).toMatchObject({ ok: false });
    expect(explainAccess({ ...subject, commentMutedUntil: new Date(NOW.getTime() - 1000) }, [], NOW).commenting.ok).toBe(true);
    expect(explainAccess({ ...subject, onboardingPending: true }, [], NOW).commenting.ok).toBe(false);
    const gone = explainAccess({ ...subject, isDeleted: true }, films, NOW);
    expect(gone.signIn.ok).toBe(false);
    expect(gone.films.map((f) => f.canWatch)).toEqual([true, false, false]);
  });
  it('viewAsPerson audits ADMIN_VIEW_AS and refuses non-admins before reading', async () => {
    const audits: any[] = [];
    const prisma: any = {
      user: { findUnique: vi.fn(async () => ({ id: 'u1', role: 'USER', isDeleted: false, emailVerified: true, onboardingPending: false, commentMutedUntil: null })) },
      video: { findMany: vi.fn(async () => films) },
      auditLog: { create: vi.fn(async ({ data }: any) => audits.push(data)) },
    };
    const ok = await viewAsPerson(createAppContext({ actor: { type: 'admin', userId: 'panel-1' }, prisma, now: () => NOW }), 'u1');
    expect(ok.ok).toBe(true);
    expect(audits[0]).toMatchObject({ action: 'ADMIN_VIEW_AS', targetType: 'User', targetId: 'u1', actorUserId: 'panel-1' });
    prisma.user.findUnique.mockClear();
    expect((await viewAsPerson(createAppContext({ actor: { type: 'guest' }, prisma }), 'u1')).ok).toBe(false);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe('deviceLabel', () => {
  it('gives browser and system, never the raw string', () => {
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537')).toBe('Chrome · Windows');
    expect(deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17) Safari/604')).toBe('Safari · iOS');
    expect(deviceLabel(null)).toBe('przeglądarka · nieznany system');
  });
});
