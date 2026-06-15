import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/admin/channel/route';
import { getAdminChannelSettings } from '@/lib/modules/channel';

vi.mock('@/lib/auth-utils', () => ({
  requireAdminForApi: vi.fn(),
}));

vi.mock('@/lib/modules/channel', () => ({
  getAdminChannelSettings: vi.fn(),
  updateAdminChannelSettings: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  createScopedLogger: vi.fn().mockReturnValue({
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

import { requireAdminForApi } from '@/lib/auth-utils';

describe('Admin Channel API Route - GET /api/admin/channel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns channel data for authenticated admin', async () => {
    (requireAdminForApi as any).mockResolvedValue({ adminUserId: 'admin-1', response: null });
    (getAdminChannelSettings as any).mockResolvedValue({ id: 'c1', name: 'Polutek' });

    const req = new NextRequest('http://localhost/api/admin/channel');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.creator.name).toBe('Polutek');
  });

  it('returns 403 when not an admin', async () => {
    const errorResponse = new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
    (requireAdminForApi as any).mockResolvedValue({ adminUserId: null, response: errorResponse });

    const req = new NextRequest('http://localhost/api/admin/channel');
    const res = await GET(req);

    expect(res.status).toBe(403);
  });

  it('returns 500 and redacted response for unexpected errors', async () => {
    (requireAdminForApi as any).mockResolvedValue({ adminUserId: 'admin-1', response: null });
    (getAdminChannelSettings as any).mockRejectedValue(new Error('Internal DB failure'));

    const req = new NextRequest('http://localhost/api/admin/channel');
    const res = await GET(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('INTERNAL_ERROR');
    // Ensure we don't leak the raw message if it's not an AppError
    expect(data.message).toContain('Spróbuj ponownie później');
  });
});
