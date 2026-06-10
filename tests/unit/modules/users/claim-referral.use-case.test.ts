import { describe, it, expect, vi, beforeEach } from 'vitest';
import { claimReferral } from '@/lib/modules/users/application/claim-referral.use-case';
import { createAppContext } from '@/lib/modules/shared/app-context';
import {
  SelfReferralError,
  UserAlreadyReferredError,
  InvalidReferralCodeError
} from '@/lib/modules/users/domain/referral.errors';
import { UserRepository } from '@/lib/modules/users/infrastructure/user.repository';
import { ReferralRepository } from '@/lib/modules/users/infrastructure/referral.repository';

vi.mock('@/lib/modules/users/infrastructure/user.repository');
vi.mock('@/lib/modules/users/infrastructure/referral.repository');

const mockUserRepo = {
  findByReferralCodeOrId: vi.fn(),
  findProfileById: vi.fn(),
  setReferredBy: vi.fn(),
  incrementReferralStats: vi.fn(),
  user: {
      update: vi.fn(),
  }
};

const mockReferralRepo = {
  findByReferredId: vi.fn(),
  create: vi.fn(),
  referral: {
      findUnique: vi.fn(),
      create: vi.fn(),
  }
};

(UserRepository as any).prototype.findByReferralCodeOrId = mockUserRepo.findByReferralCodeOrId;
(UserRepository as any).prototype.findProfileById = mockUserRepo.findProfileById;
(UserRepository as any).prototype.setReferredBy = mockUserRepo.setReferredBy;
(UserRepository as any).prototype.incrementReferralStats = mockUserRepo.incrementReferralStats;

(ReferralRepository as any).prototype.findByReferredId = mockReferralRepo.findByReferredId;
(ReferralRepository as any).prototype.create = mockReferralRepo.create;

vi.mock('@/lib/modules/patron', () => ({
  grantPatron: vi.fn().mockResolvedValue({ ok: true, data: { isPatron: true, normalizedTotal: 0 } })
}));

vi.mock('@/lib/services/user-access.service', () => ({
  UserAccessService: {
    syncClerkAccess: vi.fn().mockResolvedValue(true)
  }
}));

describe('ClaimReferralUseCase', () => {
  const ctx = createAppContext({
    actor: { type: 'user', userId: 'referred-1', isPatron: false }
  });

  // Mock writeTransaction with a tx client that has the expected structure
  const mockTx = {
      user: { update: vi.fn() },
      referral: { findUnique: vi.fn(), create: vi.fn() }
  };
  ctx.db.writeTransaction = vi.fn().mockImplementation((cb) => cb(mockTx));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully claim a referral', async () => {
    mockUserRepo.findByReferralCodeOrId.mockResolvedValue({ id: 'referrer-1' });
    mockUserRepo.findProfileById.mockResolvedValue({ id: 'referred-1', referredById: null });
    mockReferralRepo.findByReferredId.mockResolvedValue(null);
    mockReferralRepo.create.mockResolvedValue({ id: 'ref-1' });

    const result = await claimReferral(ctx, {
      referralCode: 'REF123',
      referredUserId: 'referred-1'
    });

    expect(result.ok).toBe(true);
    expect(mockReferralRepo.create).toHaveBeenCalledWith(expect.anything(), mockTx);
    expect(mockUserRepo.setReferredBy).toHaveBeenCalledWith('referred-1', 'referrer-1', mockTx);
    expect(mockUserRepo.incrementReferralStats).toHaveBeenCalledWith('referrer-1', mockTx);
  });

  it('should fail on self-referral', async () => {
    mockUserRepo.findByReferralCodeOrId.mockResolvedValue({ id: 'referred-1' });

    const result = await claimReferral(ctx, {
      referralCode: 'REF123',
      referredUserId: 'referred-1'
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
        expect(result.error).toBeInstanceOf(SelfReferralError);
    }
  });

  it('should fail on invalid referral code', async () => {
    mockUserRepo.findByReferralCodeOrId.mockResolvedValue(null);

    const result = await claimReferral(ctx, {
      referralCode: 'INVALID',
      referredUserId: 'referred-1'
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
        expect(result.error).toBeInstanceOf(InvalidReferralCodeError);
    }
  });

  it('should fail if user is already referred', async () => {
    mockUserRepo.findByReferralCodeOrId.mockResolvedValue({ id: 'referrer-1' });
    mockUserRepo.findProfileById.mockResolvedValue({ id: 'referred-1', referredById: 'other-referrer' });

    const result = await claimReferral(ctx, {
      referralCode: 'REF123',
      referredUserId: 'referred-1'
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
        expect(result.error).toBeInstanceOf(UserAlreadyReferredError);
    }
  });

  it('should grant patron if referrer reaches 5 points', async () => {
    const { grantPatron } = await import('@/lib/modules/patron');

    mockUserRepo.findByReferralCodeOrId.mockResolvedValue({ id: 'referrer-1' });
    mockUserRepo.findProfileById
      .mockResolvedValueOnce({ id: 'referred-1', referredById: null }) // Initial check
      .mockResolvedValueOnce({ id: 'referrer-1', referralPoints: 5 }); // After update check

    mockReferralRepo.findByReferredId.mockResolvedValue(null);
    mockReferralRepo.create.mockResolvedValue({ id: 'ref-1' });

    const result = await claimReferral(ctx, {
      referralCode: 'REF123',
      referredUserId: 'referred-1'
    });

    expect(result.ok).toBe(true);
    expect(grantPatron).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'referrer-1', source: 'referral' }),
        expect.anything(),
        mockTx
    );
  });
});
