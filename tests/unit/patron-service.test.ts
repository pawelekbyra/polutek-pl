import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PatronGrantSource } from '@prisma/client';
import { grantPatronStatus, revokePatronStatus } from '@/lib/services/patron.service';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    patronGrant: {
      findUnique: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/clerk', () => ({ getClerkClient: vi.fn() }));
vi.mock('@/lib/services/audit.service', () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }));

const paymentTotals = [{ currency: 'PLN', amountMinor: 2500 }];

describe('patron service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('grantPatronStatus sets isPatron, patronSince and patronSource', async () => {
    const existing = { id: 'u1', isPatron: false, patronSince: null, paymentTotals };
    vi.mocked(prisma.user.findUnique).mockResolvedValue(existing as any);
    vi.mocked(prisma.patronGrant.findUnique).mockResolvedValue(null);
    (prisma.user.update as any).mockImplementation(async ({ data }: any) => ({
      ...existing,
      ...data,
      patronSince: data.patronSince,
      paymentTotals,
    }) as any);
    vi.mocked(prisma.patronGrant.create).mockResolvedValue({ id: 'grant1' } as any);

    const result = await grantPatronStatus('u1', { source: 'stripe_tip', note: 'tip', paymentId: 'p1' });

    expect(result.user.isPatron).toBe(true);
    expect(result.user.patronSince).toBeInstanceOf(Date);
    expect(result.user.patronSource).toBe(PatronGrantSource.STRIPE_TIP);
    expect(result.becamePatronNow).toBe(true);
    expect(prisma.patronGrant.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ source: PatronGrantSource.STRIPE_TIP, paymentId: 'p1' }),
    }));
  });

  it('grantPatronStatus is idempotent for paymentId', async () => {
    const patronSince = new Date('2026-01-01T00:00:00Z');
    const existing = { id: 'u1', isPatron: true, patronSince, paymentTotals };
    const existingGrant = { id: 'grant1', paymentId: 'p1', userId: 'u1' };

    vi.mocked(prisma.patronGrant.findUnique).mockResolvedValue(existingGrant as any);
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue(existing as any);

    const result = await grantPatronStatus('u1', { source: 'stripe_tip', paymentId: 'p1' });

    expect(result.alreadyGranted).toBe(true);
    expect(result.becamePatronNow).toBe(false);
    expect(result.user.patronSince).toBe(patronSince);
    expect(prisma.patronGrant.create).not.toHaveBeenCalled();
  });

  it('grantPatronStatus is idempotent and does not reset patronSince', async () => {
    const patronSince = new Date('2026-01-01T00:00:00Z');
    const existing = { id: 'u1', isPatron: true, patronSince, paymentTotals };
    vi.mocked(prisma.user.findUnique).mockResolvedValue(existing as any);
    vi.mocked(prisma.patronGrant.findUnique).mockResolvedValue(null);
    (prisma.user.update as any).mockImplementation(async ({ data }: any) => ({
      ...existing,
      ...data,
      paymentTotals,
    }) as any);
    vi.mocked(prisma.patronGrant.create).mockResolvedValue({ id: 'grant2' } as any);

    const result = await grantPatronStatus('u1', { source: 'admin' });

    expect(result.user.patronSince).toBe(patronSince);
    expect(result.becamePatronNow).toBe(false);
  });

  it('revokePatronStatus revokes grants and does not touch payment history', async () => {
    const existing = { id: 'u1', isPatron: true, patronSince: new Date(), paymentTotals };
    vi.mocked(prisma.user.findUnique).mockResolvedValue(existing as any);
    vi.mocked(prisma.patronGrant.updateMany).mockResolvedValue({ count: 1 } as any);
    (prisma.user.update as any).mockImplementation(async ({ data }: any) => ({
      ...existing,
      ...data,
      paymentTotals,
    }) as any);

    const result = await revokePatronStatus('u1', { revokedByUserId: 'admin1' });

    expect(result.user.isPatron).toBe(false);
    expect(prisma.patronGrant.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'u1', revokedAt: null },
    }));
    expect(prisma.user.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ payments: expect.anything() }) }));
  });

  it('returns a readable error when user does not exist', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    await expect(grantPatronStatus('missing', { source: 'admin' })).rejects.toThrow('Cannot grant Patron status');
  });
});
