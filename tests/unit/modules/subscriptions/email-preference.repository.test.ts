import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailPreferenceRepository } from '@/lib/modules/subscriptions/infrastructure/email-preference.repository';

const prismaMock = {
  emailPreference: {
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
};

describe('EmailPreferenceRepository identity resolution', () => {
  let repository: EmailPreferenceRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new EmailPreferenceRepository(prismaMock as any);
  });

  describe('recordExplicitContentOptIn', () => {
    it('updates existing record by userId when emails match (Existing record persists opt-in)', async () => {
      const existing = { id: 'pref_1', userId: 'user_1', email: 'test@example.com' };
      prismaMock.emailPreference.findUnique.mockResolvedValueOnce(existing); // by userId
      prismaMock.emailPreference.update.mockResolvedValue({ id: 'pref_1' });

      const result = await repository.recordExplicitContentOptIn('user_1', 'test@example.com');

      expect(result).toEqual({ id: 'pref_1', recorded: true });
      expect(prismaMock.emailPreference.update).toHaveBeenCalledWith({
        where: { id: 'pref_1' },
        data: expect.objectContaining({ marketingEmails: true, unsubscribedAt: null, email: 'test@example.com' }),
        select: { id: true },
      });
    });

    it('updates email when userId matches but email has changed and new email is free', async () => {
      const existing = { id: 'pref_1', userId: 'user_1', email: 'old@example.com' };
      prismaMock.emailPreference.findUnique
        .mockResolvedValueOnce(existing) // by userId
        .mockResolvedValueOnce(null); // by email (conflict check)
      prismaMock.emailPreference.update.mockResolvedValue({ id: 'pref_1' });

      await repository.recordExplicitContentOptIn('user_1', 'new@example.com');

      expect(prismaMock.emailPreference.update).toHaveBeenCalledWith({
        where: { id: 'pref_1' },
        data: expect.objectContaining({ marketingEmails: true, unsubscribedAt: null, email: 'new@example.com' }),
        select: { id: true },
      });
    });

    it('does NOT update email when userId matches but new email is taken by another user (Foreign record is never updated)', async () => {
      const existing = { id: 'pref_1', userId: 'user_1', email: 'old@example.com' };
      const conflict = { id: 'pref_2', userId: 'user_2', email: 'new@example.com' };
      prismaMock.emailPreference.findUnique
        .mockResolvedValueOnce(existing) // by userId
        .mockResolvedValueOnce(conflict); // by email (conflict check)
      prismaMock.emailPreference.update.mockResolvedValue({ id: 'pref_1' });

      await repository.recordExplicitContentOptIn('user_1', 'new@example.com');

      expect(prismaMock.emailPreference.update).toHaveBeenCalledWith({
        where: { id: 'pref_1' },
        data: expect.objectContaining({ marketingEmails: true, unsubscribedAt: null }),
        select: { id: true },
      });
      const call = prismaMock.emailPreference.update.mock.calls[0][0];
      expect(call.data.email).toBeUndefined();
    });

    it('adopts existing legacy record by email when no userId record exists', async () => {
      const byEmail = { id: 'pref_2', userId: null, email: 'test@example.com' };
      prismaMock.emailPreference.findUnique
        .mockResolvedValueOnce(null) // by userId
        .mockResolvedValueOnce(byEmail); // by email
      prismaMock.emailPreference.update.mockResolvedValue({ id: 'pref_2' });

      await repository.recordExplicitContentOptIn('user_1', 'test@example.com');

      expect(prismaMock.emailPreference.update).toHaveBeenCalledWith({
        where: { id: 'pref_2' },
        data: expect.objectContaining({ userId: 'user_1', marketingEmails: true, unsubscribedAt: null }),
        select: { id: true },
      });
    });

    it('returns FOREIGN_EMAIL_CONFLICT when email belongs to another user and no userId record exists (Foreign record ID is never returned as success)', async () => {
      const byEmail = { id: 'pref_2', userId: 'user_2', email: 'test@example.com' };
      prismaMock.emailPreference.findUnique
        .mockResolvedValueOnce(null) // by userId
        .mockResolvedValueOnce(byEmail); // by email

      const result = await repository.recordExplicitContentOptIn('user_1', 'test@example.com');

      expect(result).toEqual({ id: null, recorded: false, reason: 'FOREIGN_EMAIL_CONFLICT' });
      expect(prismaMock.emailPreference.update).not.toHaveBeenCalled();
      expect(prismaMock.emailPreference.create).not.toHaveBeenCalled();
    });

    it('creates new record when neither userId nor email exist', async () => {
      prismaMock.emailPreference.findUnique
        .mockResolvedValueOnce(null) // by userId
        .mockResolvedValueOnce(null); // by email
      prismaMock.emailPreference.create.mockResolvedValue({ id: 'pref_new' });

      await repository.recordExplicitContentOptIn('user_1', 'test@example.com');

      expect(prismaMock.emailPreference.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'user_1', email: 'test@example.com', marketingEmails: true, systemEmails: true, unsubscribedAt: null }),
        select: { id: true },
      });
    });

    it('handles race condition (P2002) during create by retrying lookup (Create P2002 rereads and persists consent)', async () => {
      prismaMock.emailPreference.findUnique
        .mockResolvedValueOnce(null) // by userId
        .mockResolvedValueOnce(null); // by email

      const error = new Error('Unique constraint failed') as any;
      error.code = 'P2002';
      prismaMock.emailPreference.create.mockRejectedValueOnce(error);

      prismaMock.emailPreference.findUnique.mockResolvedValueOnce({ id: 'pref_race', userId: 'user_1' }); // retry by userId
      prismaMock.emailPreference.update.mockResolvedValue({ id: 'pref_race' });

      const result = await repository.recordExplicitContentOptIn('user_1', 'test@example.com');

      expect(result).toEqual({ id: 'pref_race', recorded: true });
      expect(prismaMock.emailPreference.update).toHaveBeenCalled();
    });

    it('handles P2002 during email adoption by retrying (Legacy-adoption P2002 persists consent safely)', async () => {
      prismaMock.emailPreference.findUnique
        .mockResolvedValueOnce(null) // by userId
        .mockResolvedValueOnce({ id: 'pref_2', userId: null, email: 'test@example.com' }); // by email

      const error = new Error('Unique constraint failed') as any;
      error.code = 'P2002';
      prismaMock.emailPreference.update.mockRejectedValueOnce(error); // adoption update fails

      prismaMock.emailPreference.findUnique.mockResolvedValueOnce({ id: 'pref_race', userId: 'user_1' }); // retry by userId
      prismaMock.emailPreference.update.mockResolvedValue({ id: 'pref_race' });

      const result = await repository.recordExplicitContentOptIn('user_1', 'test@example.com');

      expect(result).toEqual({ id: 'pref_race', recorded: true });
    });

    it('handles race condition (P2002) during update by performing consent-only fallback (Update P2002 performs consent-only fallback)', async () => {
      prismaMock.emailPreference.findUnique.mockResolvedValueOnce({ id: 'pref_1', userId: 'user_1', email: 'old@example.com' });
      prismaMock.emailPreference.findUnique.mockResolvedValueOnce(null); // no conflict check for email
      const error = new Error('Unique constraint failed') as any;
      error.code = 'P2002';
      prismaMock.emailPreference.update.mockRejectedValueOnce(error); // update with email fails

      prismaMock.emailPreference.update.mockResolvedValueOnce({ id: 'pref_1' }); // fallback update

      const result = await repository.recordExplicitContentOptIn('user_1', 'new@example.com');

      expect(result).toEqual({ id: 'pref_1', recorded: true });
      expect(prismaMock.emailPreference.update).toHaveBeenCalledTimes(2);
      expect(prismaMock.emailPreference.update).toHaveBeenLastCalledWith(expect.objectContaining({
        data: { marketingEmails: true, unsubscribedAt: null }
      }));
    });

    it('propagates non-P2002 update errors', async () => {
      prismaMock.emailPreference.findUnique.mockResolvedValueOnce({ id: 'pref_1', userId: 'user_1' });
      const error = new Error('DB Error');
      prismaMock.emailPreference.update.mockRejectedValueOnce(error);

      await expect(repository.recordExplicitContentOptIn('user_1', 'test@example.com')).rejects.toThrow('DB Error');
    });

    it('propagates non-P2002 create errors', async () => {
      prismaMock.emailPreference.findUnique.mockResolvedValue(null);
      const error = new Error('DB Error');
      prismaMock.emailPreference.create.mockRejectedValueOnce(error);

      await expect(repository.recordExplicitContentOptIn('user_1', 'test@example.com')).rejects.toThrow('DB Error');
    });

    it('asserts deterministic lookup order: userId then email', async () => {
      // Mock findUnique to return record by userId on FIRST call
      prismaMock.emailPreference.findUnique.mockResolvedValueOnce({ id: 'pref_user', userId: 'user_1', email: 'test@example.com' });
      prismaMock.emailPreference.update.mockResolvedValue({ id: 'pref_user' });

      await repository.recordExplicitContentOptIn('user_1', 'test@example.com');

      // First call should be by userId
      expect(prismaMock.emailPreference.findUnique).toHaveBeenNthCalledWith(1, { where: { userId: 'user_1' } });

      // Since userId was found, it should NOT look up by email (unless there is a potential email conflict,
      // but in this test emails match, so no conflict check is needed)
      expect(prismaMock.emailPreference.findUnique).not.toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
    });
  });

  describe('recordExplicitContentOptOut', () => {
    it('sets marketingEmails false and unsubscribedAt to date (Existing record persists opt-out)', async () => {
      prismaMock.emailPreference.findUnique.mockResolvedValue(null);
      prismaMock.emailPreference.create.mockResolvedValue({ id: 'pref_new' });

      const result = await repository.recordExplicitContentOptOut('user_1', 'test@example.com');

      expect(result).toEqual({ id: 'pref_new', recorded: true });
      expect(prismaMock.emailPreference.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          marketingEmails: false,
          unsubscribedAt: expect.any(Date),
        }),
        select: { id: true },
      });
    });
  });
});
