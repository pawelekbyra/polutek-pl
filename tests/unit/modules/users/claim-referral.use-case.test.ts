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
};

const mockReferralRepo = {
  findByReferredId: vi.fn(),
  create: vi.fn(),
};

(UserRepository as any).prototype.findByReferralCodeOrId = mockUserRepo.findByReferralCodeOrId;
(UserRepository as any).prototype.findProfileById = mockUserRepo.findProfileById;
(UserRepository as any).prototype.setReferredBy = mockUserRepo.setReferredBy;
(UserRepository as any).prototype.incrementReferralStats = mockUserRepo.incrementReferralStats;

(ReferralRepository as any).prototype.findByReferredId = mockReferralRepo.findByReferredId;
(ReferralRepository as any).prototype.create = mockReferralRepo.create;

describe('ClaimReferralUseCase', () => {
  const ctx = createAppContext({
    actor: { type: 'user', userId: 'referred-1', isPatron: false }
  });

  // Mock writeTransaction
  ctx.db.writeTransaction = vi.fn().mockImplementation((cb) => cb({}));

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
    expect(mockReferralRepo.create).toHaveBeenCalled();
    expect(mockUserRepo.setReferredBy).toHaveBeenCalledWith('referred-1', 'referrer-1', expect.anything());
    expect(mockUserRepo.incrementReferralStats).toHaveBeenCalledWith('referrer-1', expect.anything());
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
});
