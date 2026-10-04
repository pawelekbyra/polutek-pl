import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { requireAdminForApi, createBroadcast, sendBroadcastTest, listAdminBroadcastEmails } = vi.hoisted(() => ({
  requireAdminForApi: vi.fn(),
  createBroadcast: vi.fn(),
  sendBroadcastTest: vi.fn(),
  listAdminBroadcastEmails: vi.fn(),
}));

vi.mock('@/lib/auth-utils', () => ({ requireAdminForApi }));
vi.mock('@/lib/modules/email', () => ({ createBroadcast, sendBroadcastTest, listAdminBroadcastEmails }));

import { GET, POST } from '@/app/api/admin/emails/broadcast/route';
import { POST as POST_TEST } from '@/app/api/admin/emails/broadcast/test/route';

const KEY = '6f1c1f9e-6c8c-4d8e-9a59-2f8f1b2b9c11';
const post = (url: string, body: unknown) => new NextRequest(`http://localhost${url}`, { method: 'POST', body: JSON.stringify(body) });

describe('admin broadcast routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminForApi.mockResolvedValue({ adminUserId: 'admin_1', response: null });
  });

  it('requires an admin', async () => {
    requireAdminForApi.mockResolvedValue({ adminUserId: null, response: new Response('Unauthorized', { status: 401 }) });
    const res = await POST(post('/api/admin/emails/broadcast', {}));
    expect(res.status).toBe(401);
    expect(createBroadcast).not.toHaveBeenCalled();
  });

  it('queues the broadcast and answers 202 without sending in the request', async () => {
    createBroadcast.mockResolvedValue({ ok: true, data: { broadcastId: 'b1', recipientCount: 3, duplicate: false } });
    const res = await POST(post('/api/admin/emails/broadcast', { subjectPl: 'S', htmlPl: '<p>x</p>', requestKey: KEY, recipientGroup: 'MANUAL', manualEmails: 'a@b.c' }));
    expect(res.status).toBe(202);
    expect(createBroadcast).toHaveBeenCalledWith(expect.anything(), { subjectPl: 'S', htmlPl: '<p>x</p>', requestKey: KEY });
  });

  it('answers 200 with the same broadcast for a repeated request', async () => {
    createBroadcast.mockResolvedValue({ ok: true, data: { broadcastId: 'b1', recipientCount: 3, duplicate: true } });
    const res = await POST(post('/api/admin/emails/broadcast', { subjectPl: 'S', htmlPl: '<p>x</p>', requestKey: KEY }));
    expect(res.status).toBe(200);
  });

  it('rejects a request without a request key or with malformed JSON', async () => {
    expect((await POST(post('/api/admin/emails/broadcast', { subjectPl: 'S', htmlPl: 'x' }))).status).toBe(400);
    const malformed = new NextRequest('http://localhost/api/admin/emails/broadcast', { method: 'POST', body: '{' });
    expect((await POST(malformed)).status).toBe(400);
  });

  it('passes the use case error (e.g. a broadcast in progress) through', async () => {
    createBroadcast.mockResolvedValue({ ok: false, error: { message: 'busy', code: 'EMAIL_BROADCAST_IN_PROGRESS', statusCode: 409 } });
    const res = await POST(post('/api/admin/emails/broadcast', { subjectPl: 'S', htmlPl: 'x', requestKey: KEY }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'busy', code: 'EMAIL_BROADCAST_IN_PROGRESS' });
  });

  it('never passes a recipient address from the request to the test send', async () => {
    sendBroadcastTest.mockResolvedValue({ ok: true, data: { messageId: 'm1', to: 'owner@example.com' } });
    const res = await POST_TEST(post('/api/admin/emails/broadcast/test', { subjectPl: 'S', htmlPl: 'x', testEmail: 'victim@example.com', to: 'victim@example.com', language: 'en' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, to: 'owner@example.com' });
    expect(sendBroadcastTest).toHaveBeenCalledWith(expect.anything(), { subjectPl: 'S', htmlPl: 'x', language: 'en' });
  });

  it('lists the history', async () => {
    listAdminBroadcastEmails.mockResolvedValue({ ok: true, data: [{ id: 'b1' }] });
    const res = await GET();
    expect(await res.json()).toEqual([{ id: 'b1' }]);
  });
});
