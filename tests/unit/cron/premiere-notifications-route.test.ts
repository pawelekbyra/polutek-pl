import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { notifyDuePremieres, runNewVideoFanOutJobs, runStorageCleanupJobs } = vi.hoisted(() => ({
  notifyDuePremieres: vi.fn(),
  runNewVideoFanOutJobs: vi.fn(),
  runStorageCleanupJobs: vi.fn(),
}));

vi.mock('@/lib/modules/notifications', () => ({ notifyDuePremieres, runNewVideoFanOutJobs }));
vi.mock('@/lib/modules/admin-content', () => ({ runStorageCleanupJobs }));

import { GET } from '@/app/api/cron/premiere-notifications/route';

function request(secret?: string) {
  return new NextRequest('http://localhost/api/cron/premiere-notifications', {
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  });
}

describe('GET /api/cron/premiere-notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test_cron_secret';
    notifyDuePremieres.mockResolvedValue({ queued: 0 });
    runNewVideoFanOutJobs.mockResolvedValue({ completed: 1, retried: 0 });
    runStorageCleanupJobs.mockResolvedValue({ completed: 0 });
  });

  it('rejects unauthorized calls before touching any job runner', async () => {
    const response = await GET(request('wrong'));
    expect(response.status).toBe(401);
    expect(notifyDuePremieres).not.toHaveBeenCalled();
    expect(runNewVideoFanOutJobs).not.toHaveBeenCalled();
    expect(runStorageCleanupJobs).not.toHaveBeenCalled();
  });

  it('runs the durable fan-out runner on every authorized cron tick', async () => {
    const response = await GET(request(process.env.CRON_SECRET));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ queued: 0, fanOut: { completed: 1, retried: 0 }, cleanup: { completed: 0 } });
    expect(notifyDuePremieres).toHaveBeenCalledWith({ batchSize: 50 });
    expect(runNewVideoFanOutJobs).toHaveBeenCalledTimes(1);
    expect(runStorageCleanupJobs).toHaveBeenCalledTimes(1);
  });

  it('returns a failure if durable queue recovery fails', async () => {
    runNewVideoFanOutJobs.mockRejectedValueOnce(new Error('synthetic runner failure'));
    const response = await GET(request(process.env.CRON_SECRET));
    expect(response.status).toBe(500);
    expect(runNewVideoFanOutJobs).toHaveBeenCalledTimes(1);
    expect(runStorageCleanupJobs).not.toHaveBeenCalled();
  });
});
