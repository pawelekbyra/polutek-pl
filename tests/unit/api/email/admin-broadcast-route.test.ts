import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from '@/app/api/admin/emails/broadcast/route';
import { NextRequest } from 'next/server';
import { sendAdminBroadcastEmail, listAdminBroadcastEmails } from '@/lib/modules/email';
import { requireAdminForApi } from '@/lib/auth-utils';

vi.mock('@/lib/auth-utils', () => ({
  requireAdminForApi: vi.fn(),
}));

vi.mock('@/lib/modules/email', () => ({
  sendAdminBroadcastEmail: vi.fn(),
  listAdminBroadcastEmails: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({
    auth: vi.fn().mockResolvedValue({ sessionClaims: { email: 'admin@test.com' } }),
}));

describe('Admin Broadcast Route Contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST', () => {
    it('requires admin authentication', async () => {
      vi.mocked(requireAdminForApi).mockResolvedValue({
          adminUserId: '',
          response: new Response('Unauthorized', { status: 401 })
      } as any);

      const req = new NextRequest('http://localhost/api/admin/emails/broadcast', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it('calls sendAdminBroadcastEmail with mapped DTO', async () => {
      vi.mocked(requireAdminForApi).mockResolvedValue({
          adminUserId: 'admin_1',
          response: null
      } as any);
      vi.mocked(sendAdminBroadcastEmail).mockResolvedValue({ ok: true, data: { success: true } } as any);

      const req = new NextRequest('http://localhost/api/admin/emails/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          subject: 'Test Subject',
          body: 'Test Body',
          audience: 'TEST',
          testRecipientEmail: 'test@example.com'
        }),
      });

      await POST(req);
      expect(sendAdminBroadcastEmail).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
              subject: 'Test Subject',
              audience: 'TEST'
          })
      );
    });

    it('supports backward compatibility mapping', async () => {
        vi.mocked(requireAdminForApi).mockResolvedValue({
            adminUserId: 'admin_1',
            response: null
        } as any);
        vi.mocked(sendAdminBroadcastEmail).mockResolvedValue({ ok: true, data: { success: true } } as any);

        const req = new NextRequest('http://localhost/api/admin/emails/broadcast', {
            method: 'POST',
            body: JSON.stringify({
                subjectPl: 'Pl Subject',
                htmlPl: 'Pl Html',
                recipientGroup: 'PATRONS'
            }),
        });

        await POST(req);
        expect(sendAdminBroadcastEmail).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                subject: 'Pl Subject',
                body: 'Pl Html',
                audience: 'PATRONS'
            })
        );
    });
  });

  describe('GET', () => {
    it('requires admin authentication', async () => {
      vi.mocked(requireAdminForApi).mockResolvedValue({
          adminUserId: '',
          response: new Response('Unauthorized', { status: 401 })
      } as any);

      const req = new NextRequest('http://localhost/api/admin/emails/broadcast', {
        method: 'GET',
      });

      const res = await GET(req);
      expect(res.status).toBe(401);
    });

    it('calls listAdminBroadcastEmails', async () => {
      vi.mocked(requireAdminForApi).mockResolvedValue({
          adminUserId: 'admin_1',
          response: null
      } as any);
      vi.mocked(listAdminBroadcastEmails).mockResolvedValue({ ok: true, data: [] } as any);

      const req = new NextRequest('http://localhost/api/admin/emails/broadcast', {
        method: 'GET',
      });

      await GET(req);
      expect(listAdminBroadcastEmails).toHaveBeenCalled();
    });
  });
});
