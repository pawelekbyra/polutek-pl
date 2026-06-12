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

      await repository.recordExplicitContentOptIn('user_1', 'test@example.com');

      expect(prismaMock.emailPreference.update).toHaveBeenCalledWith({
        where: { id: 'pref_1' },
        data: { marketingEmails: true, unsubscribedAt: null, email: 'test@example.com' },
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
        data: { marketingEmails: true, unsubscribedAt: null, email: 'new@example.com' },
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

      await repository.recordExplicitContentOptIn('user_1', 'new@example.com');

      expect(prismaMock.emailPreference.update).toHaveBeenCalledWith({
        where: { id: 'pref_1' },
        data: { marketingEmails: true, unsubscribedAt: null },
        select: { id: true },
      });
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
        data: { userId: 'user_1', marketingEmails: true, unsubscribedAt: null },
        select: { id: true },
      });
    });

    it('skips mutation when email belongs to another user and no userId record exists', async () => {
      const byEmail = { id: 'pref_2', userId: 'user_2', email: 'test@example.com' };
      prismaMock.emailPreference.findUnique
        .mockResolvedValueOnce(null) // by userId
        .mockResolvedValueOnce(byEmail); // by email

      const result = await repository.recordExplicitContentOptIn('user_1', 'test@example.com');

      expect(result).toEqual({ id: 'pref_2' });
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
        data: { userId: 'user_1', email: 'test@example.com', marketingEmails: true, systemEmails: true, unsubscribedAt: null },
        select: { id: true },
      });
    });
  });

  describe('recordExplicitContentOptOut', () => {
    it('sets marketingEmails false and unsubscribedAt to date', async () => {
      prismaMock.emailPreference.findUnique.mockResolvedValue(null);
      prismaMock.emailPreference.create.mockResolvedValue({ id: 'pref_new' });

      await repository.recordExplicitContentOptOut('user_1', 'test@example.com');

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
