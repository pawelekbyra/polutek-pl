import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserAccessService } from '@/lib/services/user-access.service';

// We need to mock the modules that are dynamically imported
vi.mock('@/lib/modules/patron', () => ({
  recalculatePatronStatus: vi.fn(),
}));

vi.mock('@/lib/modules/shared/app-context', () => ({
  createAppContext: vi.fn().mockReturnValue({}),
}));

vi.mock('@/lib/clerk', () => ({ getClerkClient: vi.fn() }));
vi.mock('@/lib/services/audit.service', () => ({ writeAuditLog: vi.fn().mockResolvedValue(undefined) }));

describe('UserAccessService.recalculateUserPatronStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the user as Patron when use case returns isPatron true', async () => {
    const { recalculatePatronStatus } = await import('@/lib/modules/patron');
    vi.mocked(recalculatePatronStatus).mockResolvedValue({
      ok: true,
      data: {
        isPatron: true,
        normalizedTotal: 100,
        patronSince: new Date(),
        patronSource: 'REFERRAL'
      }
    } as any);

    const result = await UserAccessService.recalculateUserPatronStatus('user_1');

    expect(result.isPatron).toBe(true);
    expect(result.normalizedTotal).toBe(100);
    expect(recalculatePatronStatus).toHaveBeenCalledWith('user_1', expect.anything(), undefined);
  });

  it('revokes Patron access when use case returns isPatron false', async () => {
    const { recalculatePatronStatus } = await import('@/lib/modules/patron');
    vi.mocked(recalculatePatronStatus).mockResolvedValue({
      ok: true,
      data: {
        isPatron: false,
        normalizedTotal: 0,
        patronSince: null,
        patronSource: null
      }
    } as any);

    const result = await UserAccessService.recalculateUserPatronStatus('user_1');

    expect(result.isPatron).toBe(false);
    expect(result.normalizedTotal).toBe(0);
  });

  it('throws error if use case fails', async () => {
      const { recalculatePatronStatus } = await import('@/lib/modules/patron');
      vi.mocked(recalculatePatronStatus).mockResolvedValue({
          ok: false,
          error: { message: 'DB_ERROR' }
      } as any);

      await expect(UserAccessService.recalculateUserPatronStatus('user_1')).rejects.toThrow('DB_ERROR');
  });
});
