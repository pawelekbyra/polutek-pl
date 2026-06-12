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
    it('updates existing record by userId when emails match', async () => {
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

      const result = await repository.recordExplicitContentOptIn('user_1', 'new@example.com');

      expect(result).toEqual({ id: 'pref_1', recorded: true });
      expect(prismaMock.emailPreference.update).toHaveBeenCalledWith({
        where: { id: 'pref_1' },
        data: expect.objectContaining({ marketingEmails: true, unsubscribedAt: null, email: 'new@example.com' }),
        select: { id: true },
      });
    });

    it('does NOT update email when userId matches but new email is taken by another user', async () => {
      const existing = { id: 'pref_1', userId: 'user_1', email: 'old@example.com' };
      const conflict = { id: 'pref_2', userId: 'user_2', email: 'new@example.com' };
      prismaMock.emailPreference.findUnique
        .mockResolvedValueOnce(existing) // by userId
        .mockResolvedValueOnce(conflict); // by email (conflict check)
      prismaMock.emailPreference.update.mockResolvedValue({ id: 'pref_1' });

      const result = await repository.recordExplicitContentOptIn('user_1', 'new@example.com');

      expect(result).toEqual({ id: 'pref_1', recorded: true });
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

      const result = await repository.recordExplicitContentOptIn('user_1', 'test@example.com');

      expect(result).toEqual({ id: 'pref_2', recorded: true });
      expect(prismaMock.emailPreference.update).toHaveBeenCalledWith({
        where: { id: 'pref_2' },
        data: expect.objectContaining({ userId: 'user_1', marketingEmails: true, unsubscribedAt: null }),
        select: { id: true },
      });
    });

    it('returns neutral result when email belongs to another user and no userId record exists', async () => {
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

      const result = await repository.recordExplicitContentOptIn('user_1', 'test@example.com');

      expect(result).toEqual({ id: 'pref_new', recorded: true });
      expect(prismaMock.emailPreference.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'user_1', email: 'test@example.com', marketingEmails: true, systemEmails: true, unsubscribedAt: null }),
        select: { id: true },
      });
    });

    it('handles race condition (P2002) during update with email migration by performing fallback update', async () => {
      const existing = { id: 'pref_1', userId: 'user_1', email: 'old@example.com' };
      prismaMock.emailPreference.findUnique
        .mockResolvedValueOnce(existing) // by userId
        .mockResolvedValueOnce(null); // by email (appears free)

      const error = { code: 'P2002' };
      prismaMock.emailPreference.update
        .mockRejectedValueOnce(error) // migration update fails
        .mockResolvedValueOnce({ id: 'pref_1' }); // fallback update succeeds

      const result = await repository.recordExplicitContentOptIn('user_1', 'new@example.com');

      expect(result).toEqual({ id: 'pref_1', recorded: true });
      expect(prismaMock.emailPreference.update).toHaveBeenCalledTimes(2);
      expect(prismaMock.emailPreference.update).toHaveBeenLastCalledWith({
        where: { id: 'pref_1' },
        data: { marketingEmails: true, unsubscribedAt: null },
        select: { id: true },
      });
    });

    it('handles race condition (P2002) during create by retrying lookup and persisting consent', async () => {
      prismaMock.emailPreference.findUnique
        .mockResolvedValueOnce(null) // by userId
        .mockResolvedValueOnce(null); // by email

      const error = { code: 'P2002' };
      prismaMock.emailPreference.create.mockRejectedValueOnce(error);

      // Retry lookup finds existing record
      prismaMock.emailPreference.findUnique.mockResolvedValueOnce({ id: 'pref_race', userId: 'user_1' });
      prismaMock.emailPreference.update.mockResolvedValueOnce({ id: 'pref_race' });

      const result = await repository.recordExplicitContentOptIn('user_1', 'test@example.com');

      expect(result).toEqual({ id: 'pref_race', recorded: true });
      expect(prismaMock.emailPreference.update).toHaveBeenCalledWith({
        where: { id: 'pref_race' },
        data: { marketingEmails: true, unsubscribedAt: null },
        select: { id: true },
      });
    });

    it('handles race condition (P2002) during create when email is taken by another user after conflict', async () => {
      prismaMock.emailPreference.findUnique
        .mockResolvedValueOnce(null) // by userId
        .mockResolvedValueOnce(null); // by email

      const error = { code: 'P2002' };
      prismaMock.emailPreference.create.mockRejectedValueOnce(error);

      // Retry lookup finds record owned by someone else
      prismaMock.emailPreference.findUnique
        .mockResolvedValueOnce(null) // by userId still none
        .mockResolvedValueOnce({ id: 'pref_foreign', userId: 'user_other', email: 'test@example.com' }); // by email

      const result = await repository.recordExplicitContentOptIn('user_1', 'test@example.com');

      expect(result).toEqual({ id: null, recorded: false, reason: 'FOREIGN_EMAIL_CONFLICT' });
      expect(prismaMock.emailPreference.update).not.toHaveBeenCalled();
    });

    it('handles race condition (P2002) during legacy adoption', async () => {
      const byEmail = { id: 'pref_2', userId: null, email: 'test@example.com' };
      prismaMock.emailPreference.findUnique
        .mockResolvedValueOnce(null) // by userId
        .mockResolvedValueOnce(byEmail); // by email

      prismaMock.emailPreference.update.mockRejectedValueOnce({ code: 'P2002' }); // adoption fails

      prismaMock.emailPreference.findUnique.mockResolvedValueOnce({ id: 'pref_race', userId: 'user_1' }); // retry by userId finds record
      prismaMock.emailPreference.update.mockResolvedValueOnce({ id: 'pref_race' });

      const result = await repository.recordExplicitContentOptIn('user_1', 'test@example.com');

      expect(result).toEqual({ id: 'pref_race', recorded: true });
      expect(prismaMock.emailPreference.update).toHaveBeenLastCalledWith({
        where: { id: 'pref_race' },
        data: { marketingEmails: true, unsubscribedAt: null },
        select: { id: true },
      });
    });
  });

  describe('recordExplicitContentOptOut', () => {
    it('sets marketingEmails false and unsubscribedAt to date', async () => {
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

    it('handles P2002 on opt-out migration by fallback update', async () => {
      const existing = { id: 'pref_1', userId: 'user_1', email: 'old@example.com' };
      prismaMock.emailPreference.findUnique
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce(null);

      prismaMock.emailPreference.update
        .mockRejectedValueOnce({ code: 'P2002' })
        .mockResolvedValueOnce({ id: 'pref_1' });

      await repository.recordExplicitContentOptOut('user_1', 'new@example.com');

      expect(prismaMock.emailPreference.update).toHaveBeenCalledTimes(2);
      expect(prismaMock.emailPreference.update).toHaveBeenLastCalledWith({
        where: { id: 'pref_1' },
        data: expect.objectContaining({
          marketingEmails: false,
          unsubscribedAt: expect.any(Date),
        }),
        select: { id: true },
      });
    });
  });
});
