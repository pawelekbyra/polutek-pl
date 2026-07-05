import { describe, expect, it } from 'vitest';
import { AccessTier, StorageProvider } from '@prisma/client';
import { VideoDistributionPlanService } from '@/lib/modules/video/application/video-distribution-plan.service';

function ctxForPlan() {
  const calls: any = { deactivated: 0, created: null };
  const tx = {
    videoDistributionPlan: {
      updateMany: async () => { calls.deactivated += 1; },
      create: async ({ data }: any) => {
        calls.created = data;
        return { id: 'plan-new', ...data, targets: data.targets.create.map((target: any, index: number) => ({ id: `target-${index}`, ...target })) };
      },
    },
  };
  return {
    calls,
    ctx: {
      actor: { type: 'admin', userId: 'admin-1' },
      prisma: { video: { findUnique: async () => ({ id: 'video-1', tier: AccessTier.PUBLIC }) } },
      db: { writeTransaction: async (fn: any) => fn(tx) },
    } as any,
  };
}

describe('VideoDistributionPlanService', () => {
  it('creates one Mux target for Mux-only strategy', async () => {
    const { ctx, calls } = ctxForPlan();
    await new VideoDistributionPlanService().createOrReplaceActivePlan({ videoId: 'video-1', strategy: { mode: 'SINGLE_PROVIDER', provider: 'MUX' } }, ctx);
    expect(calls.created.targets.create).toHaveLength(1);
    expect(calls.created.targets.create[0]).toMatchObject({ provider: StorageProvider.MUX, role: 'PRIMARY', required: true, desiredPrimary: true });
  });

  it('creates one Cloudflare target for Cloudflare-only strategy', async () => {
    const { ctx, calls } = ctxForPlan();
    await new VideoDistributionPlanService().createOrReplaceActivePlan({ videoId: 'video-1', strategy: { mode: 'SINGLE_PROVIDER', provider: 'CLOUDFLARE_STREAM' } }, ctx);
    expect(calls.created.targets.create).toHaveLength(1);
    expect(calls.created.targets.create[0].provider).toBe(StorageProvider.CLOUDFLARE_STREAM);
  });

  it('creates both targets for multi-provider strategy', async () => {
    const { ctx, calls } = ctxForPlan();
    await new VideoDistributionPlanService().createOrReplaceActivePlan({ videoId: 'video-1', strategy: { mode: 'MULTI_PROVIDER', providers: ['CLOUDFLARE_STREAM', 'MUX'], preferredProvider: 'MUX' } }, ctx);
    expect(calls.created.targets.create.map((target: any) => target.provider)).toEqual([StorageProvider.CLOUDFLARE_STREAM, StorageProvider.MUX]);
    expect(calls.created.targets.create.find((target: any) => target.provider === StorageProvider.MUX)).toMatchObject({ role: 'PRIMARY', required: true, desiredPrimary: true });
  });

  it('creates no targets for manual strategy and deactivates previous plans', async () => {
    const { ctx, calls } = ctxForPlan();
    await new VideoDistributionPlanService().createOrReplaceActivePlan({ videoId: 'video-1', strategy: { mode: 'MANUAL' } }, ctx);
    expect(calls.deactivated).toBe(1);
    expect(calls.created.targets.create).toEqual([]);
  });

  it('blocks embed-only providers for patron tier through capability validation', async () => {
    const { ctx } = ctxForPlan();
    ctx.prisma.video.findUnique = async () => ({ id: 'video-1', tier: AccessTier.PATRON });
    await expect(new VideoDistributionPlanService().createOrReplaceActivePlan({ videoId: 'video-1', strategy: { mode: 'MULTI_PROVIDER', providers: ['YOUTUBE' as any] } }, ctx)).rejects.toThrow(/not an automatic file playback provider/);
  });
});
