import { describe, expect, it, vi, beforeEach } from 'vitest';
import fs from 'fs';
import { GET, POST, DELETE } from '@/app/api/subscriptions/route';
import { getActorFromAuth } from '@/lib/api/auth';
import { auth } from '@clerk/nextjs/server';
import { rateLimit } from '@/lib/rate-limit';
import { GetSubscriptionStatusUseCase, SubscribeUseCase, UnsubscribeUseCase } from "@/lib/modules/subscriptions";
import { GetOrCreateUserUseCase } from '@/lib/modules/users';
import { NextRequest } from 'next/server';

vi.mock('@/lib/api/auth');
vi.mock('@clerk/nextjs/server');
vi.mock('@/lib/rate-limit');
vi.mock('@/lib/modules/subscriptions');
vi.mock('@/lib/modules/users');
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  createScopedLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })
}));

describe('subscriptions route behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(rateLimit).mockResolvedValue({ success: true } as any);
  });

  describe('GET', () => {
    it('returns 401 for guest', async () => {
      vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'guest' });
      const req = new NextRequest('http://localhost/api/subscriptions');

      const res = await GET(req);

      expect(res.status).toBe(401);
      expect(GetSubscriptionStatusUseCase.execute).not.toHaveBeenCalled();
    });

    it('returns status for authenticated user without requiring email claim', async () => {
      vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'user', userId: 'user_1', isPatron: false });
      vi.mocked(auth).mockResolvedValue({ sessionClaims: {} } as any);
      vi.mocked(GetSubscriptionStatusUseCase.execute).mockResolvedValue({
        isSubscribed: true,
        subscribedAt: new Date(),
        subscribersCount: 10,
        creatorId: 'c1',
        creatorSlug: 'p1',
        purpose: 'EMAIL_NOTIFICATIONS'
      });

      const req = new NextRequest('http://localhost/api/subscriptions');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(GetSubscriptionStatusUseCase.execute).toHaveBeenCalled();
      expect(GetOrCreateUserUseCase.execute).not.toHaveBeenCalled();
    });
  });

  describe('POST', () => {
    it('returns 400 when trusted email is missing from claims', async () => {
      vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'user', userId: 'user_1', isPatron: false });
      vi.mocked(auth).mockResolvedValue({ sessionClaims: {} } as any);

      const req = new NextRequest('http://localhost/api/subscriptions', { method: 'POST' });
      const res = await POST(req);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('TRUSTED_EMAIL_REQUIRED');
      expect(SubscribeUseCase.execute).not.toHaveBeenCalled();
    });

    it('syncs user and subscribes when trusted email is present', async () => {
      vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'user', userId: 'user_1', isPatron: false });
      vi.mocked(auth).mockResolvedValue({
        sessionClaims: { email: 'test@example.com', name: 'Test' }
      } as any);
      vi.mocked(SubscribeUseCase.execute).mockResolvedValue({ isSubscribed: true } as any);

      const req = new NextRequest('http://localhost/api/subscriptions', { method: 'POST' });
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(GetOrCreateUserUseCase.execute).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        email: 'test@example.com'
      }));
      expect(SubscribeUseCase.execute).toHaveBeenCalledWith(expect.anything(), { trustedEmail: 'test@example.com' });
    });
  });

  describe('DELETE', () => {
    it('returns 400 when trusted email is missing', async () => {
      vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'user', userId: 'user_1', isPatron: false });
      vi.mocked(auth).mockResolvedValue({ sessionClaims: {} } as any);

      const req = new NextRequest('http://localhost/api/subscriptions', { method: 'DELETE' });
      const res = await DELETE(req);

      expect(res.status).toBe(400);
      expect(UnsubscribeUseCase.execute).not.toHaveBeenCalled();
    });

    it('syncs user and unsubscribes when trusted email is present', async () => {
      vi.mocked(getActorFromAuth).mockResolvedValue({ type: 'user', userId: 'user_1', isPatron: false });
      vi.mocked(auth).mockResolvedValue({
        sessionClaims: { primary_email_address: 'test@example.com' }
      } as any);
      vi.mocked(UnsubscribeUseCase.execute).mockResolvedValue({ isSubscribed: false } as any);

      const req = new NextRequest('http://localhost/api/subscriptions', { method: 'DELETE' });
      const res = await DELETE(req);

      expect(res.status).toBe(200);
      expect(UnsubscribeUseCase.execute).toHaveBeenCalledWith(expect.anything(), { trustedEmail: 'test@example.com' });
    });
  });

  describe('Security invariants', () => {
    it('does not read arbitrary email from request body', () => {
      const source = fs.readFileSync('app/api/subscriptions/route.ts', 'utf8');
      expect(source).not.toMatch(/trustedEmail:\s*.*body/i);
    });
  });
});
