import { describe, it, expect, vi } from 'vitest';
import {
  channelDurationLimitMessage,
  exceedsChannelDurationLimit,
  formatDurationText,
} from '@/lib/modules/video-pipeline/domain/encode-job.state';

const hoisted = vi.hoisted(() => ({ isMainChannelId: vi.fn() }));
vi.mock('@/lib/modules/channel', () => ({ isMainChannelId: hoisted.isMainChannelId }));

import {
  getChannelLimitsView,
  resolveJobDurationLimit,
} from '@/lib/modules/video-pipeline/application/channel-limits';

function ctxWith(quota: Record<string, unknown> | null) {
  return {
    prisma: { channelQuota: { findUnique: vi.fn(async () => quota) } },
    actor: { type: 'system', reason: 'video_encode_worker' },
    now: () => new Date('2026-10-14T10:00:00Z'),
  } as never;
}

const QUOTA = {
  maxStorageBytes: BigInt(10 * 1024 ** 3),
  maxUploadBytes: BigInt(2 * 1024 ** 3),
  maxVideoSeconds: 900,
  maxUploadsPerDay: 5,
  maxQueuedJobs: 2,
};

describe('exceedsChannelDurationLimit', () => {
  it('equal to the limit passes, a whole second over fails', () => {
    expect(exceedsChannelDurationLimit(900, 900)).toBe(false);
    expect(exceedsChannelDurationLimit(900.9, 900)).toBe(false);
    expect(exceedsChannelDurationLimit(901, 900)).toBe(true);
    expect(exceedsChannelDurationLimit(7200, 900)).toBe(true);
  });

  it('no limit means no failure', () => {
    expect(exceedsChannelDurationLimit(10 * 3600, null)).toBe(false);
  });
});

describe('creator-facing text', () => {
  it('formats durations', () => {
    expect(formatDurationText(0)).toBe('0 s');
    expect(formatDurationText(45)).toBe('45 s');
    expect(formatDurationText(1800)).toBe('30 min');
    expect(formatDurationText(3725)).toBe('1 h 2 min 5 s');
  });

  it('names both the film length and the limit', () => {
    const text = channelDurationLimitMessage(2712, 1800);
    expect(text).toContain('45 min 12 s');
    expect(text).toContain('30 min');
  });
});

describe('resolveJobDurationLimit', () => {
  it('returns the channel quota for a creator-uploaded video on an ordinary channel', async () => {
    hoisted.isMainChannelId.mockResolvedValue(false);
    expect(await resolveJobDurationLimit(ctxWith(QUOTA), { channelId: 'c1', requestedById: null })).toBe(900);
  });

  it('falls back to the trust level 0 default when the channel has no quota row', async () => {
    hoisted.isMainChannelId.mockResolvedValue(false);
    expect(await resolveJobDurationLimit(ctxWith(null), { channelId: 'c1', requestedById: null })).toBe(30 * 60);
  });

  it('skips the platform main channel', async () => {
    hoisted.isMainChannelId.mockResolvedValue(true);
    expect(await resolveJobDurationLimit(ctxWith(QUOTA), { channelId: 'main', requestedById: null })).toBeNull();
  });

  it('skips a job requested by staff', async () => {
    hoisted.isMainChannelId.mockResolvedValue(false);
    expect(await resolveJobDurationLimit(ctxWith(QUOTA), { channelId: 'c1', requestedById: 'admin-1' })).toBeNull();
  });

  it('skips a job without a channel', async () => {
    expect(await resolveJobDurationLimit(ctxWith(QUOTA), { channelId: null, requestedById: null })).toBeNull();
  });
});

describe('getChannelLimitsView (what the Studio shows)', () => {
  it('is read only data of the channel quota', async () => {
    hoisted.isMainChannelId.mockResolvedValue(false);
    expect(await getChannelLimitsView(ctxWith(QUOTA), 'c1')).toEqual({
      maxVideoSeconds: 900,
      maxUploadBytes: 2 * 1024 ** 3,
      maxUploadsPerDay: 5,
    });
  });

  it('is null for the main channel (global limits only)', async () => {
    hoisted.isMainChannelId.mockResolvedValue(true);
    expect(await getChannelLimitsView(ctxWith(QUOTA), 'main')).toBeNull();
  });
});
