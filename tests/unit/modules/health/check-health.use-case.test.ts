import { getMainChannel } from "@/lib/modules/channel";
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkHealth } from '@/lib/modules/health';
import { createAppContext } from '@/lib/modules/shared/app-context';

vi.mock("@/lib/modules/channel", () => ({
  getMainChannel: vi.fn(),
}));

describe('checkHealth Use Case', () => {
  const mockPrisma = {
    $queryRaw: vi.fn().mockResolvedValue([{ 1: 1 }]),
    creator: {
      findFirst: vi.fn(),
    },
    video: {
      count: vi.fn(),
      findFirst: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HEALTHCHECK_TOKEN = 'test-token';
    vi.mocked(getMainChannel).mockResolvedValue({ id: 'main-channel-id' } as any);
  });

  const ctx = createAppContext({
    prisma: mockPrisma as any,
    actor: { type: 'guest' },
  });

  it('returns simple ok if token is missing or incorrect', async () => {
    const result = await checkHealth(ctx, null);
    expect(result).toEqual({ ok: true });
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('returns full health info if token is correct', async () => {
    mockPrisma.creator.findFirst.mockResolvedValue({ id: 'creator-1' });
    mockPrisma.video.count.mockResolvedValue(10);
    mockPrisma.video.findFirst.mockResolvedValue({ id: 'video-1' });

    const result = await checkHealth(ctx, 'test-token');

    expect(result.ok).toBe(true);
    expect(result.database).toBe('ok');
    expect(result.content?.allVideosCount).toBe(10);
    expect(mockPrisma.$queryRaw).toHaveBeenCalled();
  });
});
