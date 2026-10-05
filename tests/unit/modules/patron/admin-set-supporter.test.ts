import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ grantPatron: vi.fn(), revokePatron: vi.fn(), active: [] as any[] }));
vi.mock('@/lib/modules/patron/application/grant-patron.use-case', () => ({ grantPatron: m.grantPatron }));
vi.mock('@/lib/modules/patron/application/revoke-patron.use-case', () => ({ revokePatron: m.revokePatron }));
vi.mock('@/lib/modules/patron/infrastructure/patron.repository', () => ({ PatronRepository: class { listActiveGrants = async () => m.active; } }));

import { createAppContext } from '@/lib/modules/shared/app-context';
import { adminSetSupporter } from '@/lib/modules/patron/application/admin-set-supporter.use-case';

let user: any;
const prisma: any = { user: { findUnique: vi.fn(async () => user) } };
const ctx = (actor: any = { type: 'admin', userId: 'panel-1' }) => createAppContext({ actor, prisma });

beforeEach(() => {
  vi.clearAllMocks();
  user = { isDeleted: false };
  m.active = [];
  m.grantPatron.mockResolvedValue({ ok: true, data: { isPatron: true } });
  m.revokePatron.mockResolvedValue({ ok: true, data: { isPatron: false } });
});

describe('adminSetSupporter', () => {
  it('grants with the reason and the panel account as grantor', async () => {
    expect(await adminSetSupporter(ctx(), { userId: 'u1', action: 'grant', reason: ' wsparcie przelewem ' })).toEqual({ ok: true, data: { changed: true, isSupporter: true } });
    expect(m.grantPatron).toHaveBeenCalledWith({ userId: 'u1', source: 'admin', grantedByUserId: 'panel-1', note: 'wsparcie przelewem' }, expect.anything());
  });
  it('granting again when an ADMIN grant is active reports no change', async () => {
    m.active = [{ source: 'ADMIN' }];
    expect(await adminSetSupporter(ctx(), { userId: 'u1', action: 'grant', reason: 'powód' })).toMatchObject({ ok: true, data: { changed: false } });
  });
  it('revokes active grants with the reason; revoking with none active is a no-op', async () => {
    m.active = [{ source: 'STRIPE_TIP' }];
    expect(await adminSetSupporter(ctx(), { userId: 'u1', action: 'revoke', reason: 'pomyłka' })).toEqual({ ok: true, data: { changed: true, isSupporter: false } });
    expect(m.revokePatron).toHaveBeenCalledWith({ userId: 'u1', note: 'pomyłka', reason: 'pomyłka' }, expect.anything());
    m.revokePatron.mockClear();
    m.active = [];
    expect(await adminSetSupporter(ctx(), { userId: 'u1', action: 'revoke', reason: 'pomyłka' })).toEqual({ ok: true, data: { changed: false, isSupporter: false } });
    expect(m.revokePatron).not.toHaveBeenCalled();
  });
  it('requires a reason of 3-300 characters, an admin actor and a live account', async () => {
    expect(await adminSetSupporter(ctx(), { userId: 'u1', action: 'grant', reason: 'ab' })).toMatchObject({ ok: false });
    expect(await adminSetSupporter(ctx(), { userId: 'u1', action: 'grant', reason: 'x'.repeat(301) })).toMatchObject({ ok: false });
    expect(await adminSetSupporter(ctx({ type: 'system', reason: 'cron' }), { userId: 'u1', action: 'grant', reason: 'powód' })).toMatchObject({ ok: false });
    user = { isDeleted: true };
    expect(await adminSetSupporter(ctx(), { userId: 'u1', action: 'grant', reason: 'powód' })).toMatchObject({ ok: false });
    user = null;
    expect(await adminSetSupporter(ctx(), { userId: 'u1', action: 'grant', reason: 'powód' })).toMatchObject({ ok: false });
    expect(m.grantPatron).not.toHaveBeenCalled();
  });
});
