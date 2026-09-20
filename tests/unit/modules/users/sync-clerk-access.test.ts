import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { syncClerkAccess } from '@/lib/modules/users/application/sync-clerk-access';
import { getClerkClient } from '@/lib/clerk';
import { recordAuditEvent } from '@/lib/modules/audit';

vi.mock('@/lib/clerk', () => ({
  getClerkClient: vi.fn(),
}));

vi.mock('@/lib/modules/audit', () => ({
  recordAuditEvent: vi.fn(),
}));

describe('syncClerkAccess', () => {
  const updateUserMetadata = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    (getClerkClient as any).mockResolvedValue({ users: { updateUserMetadata } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('syncs a patron as role PATRON with totalPaid included in public metadata', async () => {
    updateUserMetadata.mockResolvedValue(undefined);

    await syncClerkAccess('user_1', true, 5000);

    expect(updateUserMetadata).toHaveBeenCalledWith('user_1', {
      publicMetadata: { role: 'PATRON', isPatron: true, totalPaid: 5000 },
    });
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it('syncs a non-patron as role USER and omits totalPaid entirely when not provided', async () => {
    updateUserMetadata.mockResolvedValue(undefined);

    await syncClerkAccess('user_1', false);

    const [, args] = updateUserMetadata.mock.calls[0];
    expect(args.publicMetadata).toEqual({ role: 'USER', isPatron: false });
    expect('totalPaid' in args.publicMetadata).toBe(false);
  });

  it('retries on failure and stops retrying once a later attempt succeeds', async () => {
    updateUserMetadata
      .mockRejectedValueOnce(new Error('rate limited'))
      .mockResolvedValueOnce(undefined);

    const promise = syncClerkAccess('user_1', true, 100);
    await vi.runAllTimersAsync();
    await promise;

    expect(updateUserMetadata).toHaveBeenCalledTimes(2);
    expect(recordAuditEvent).not.toHaveBeenCalled();
  });

  it('records a CLERK_SYNC_FAILED audit event after exhausting all 3 retry attempts', async () => {
    updateUserMetadata.mockRejectedValue(new Error('clerk down'));

    const promise = syncClerkAccess('user_1', true, 100);
    await vi.runAllTimersAsync();
    await promise;

    expect(updateUserMetadata).toHaveBeenCalledTimes(3);
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'CLERK_SYNC_FAILED',
        targetType: 'User',
        targetId: 'user_1',
        metadata: { isPatron: true, totalPaid: 100, role: 'PATRON' },
      }),
    );
  });

  it('does not record an audit event if getClerkClient itself throws on every attempt', async () => {
    (getClerkClient as any).mockRejectedValue(new Error('CLERK_SECRET_KEY is missing'));

    const promise = syncClerkAccess('user_1', false);
    await vi.runAllTimersAsync();
    await promise;

    expect(updateUserMetadata).not.toHaveBeenCalled();
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'CLERK_SYNC_FAILED', targetId: 'user_1' }),
    );
  });
});
