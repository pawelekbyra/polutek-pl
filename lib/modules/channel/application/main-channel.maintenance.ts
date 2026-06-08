import { VideoStatus } from '@prisma/client';
import { AppContext } from '@/lib/modules/shared/app-context';
import { recordAuditEvent } from '@/lib/modules/audit';
import { flags } from '@/lib/feature-flags';
import { MAIN_CREATOR_NAME } from '@/lib/constants';

export interface MainChannelSetupPreview {
  mainChannelId: string | null;
  mainChannelSlug: string | null;
  videosOutsideMainChannel: number;
  publishedVideosOutsideMainChannel: number;
  commentsWithoutCreatorId: number;
  commentsOutsideMainChannel: number;
  paymentsOutsideMainChannel: number;
  subscriptionsOutsideMainChannel: number;
  primaryCreatorsCount: number;
  approvedCreatorsCount: number;
  totalCreatorsCount: number;
}

export class MainChannelMaintenance {
  static async previewMainChannelSetup(ctx: AppContext): Promise<MainChannelSetupPreview> {
    const slug = flags.mainCreatorSlug;
    const mainChannel = slug ? await ctx.prisma.creator.findUnique({ where: { slug } }) : null;
    const mainChannelId = mainChannel?.id || null;

    const [
      videosOutside,
      publishedVideosOutside,
      commentsNoId,
      commentsOutside,
      paymentsOutside,
      subscriptionsOutside,
      primaryCount,
      approvedCount,
      totalCreators,
    ] = await Promise.all([
      ctx.prisma.video.count({ where: mainChannelId ? { creatorId: { not: mainChannelId } } : {} }),
      ctx.prisma.video.count({
        where: {
          status: VideoStatus.PUBLISHED,
          ...(mainChannelId ? { creatorId: { not: mainChannelId } } : {})
        }
      }),
      ctx.prisma.comment.count({ where: { creatorId: null } }),
      ctx.prisma.comment.count({ where: mainChannelId ? { creatorId: { not: mainChannelId } } : {} }),
      ctx.prisma.payment.count({ where: mainChannelId ? { creatorId: { not: mainChannelId } } : {} }),
      ctx.prisma.subscription.count({ where: mainChannelId ? { creatorId: { not: mainChannelId } } : {} }),
      ctx.prisma.creator.count({ where: { isPrimary: true } }),
      ctx.prisma.creator.count({ where: { isApproved: true } }),
      ctx.prisma.creator.count(),
    ]);

    return {
      mainChannelId,
      mainChannelSlug: slug || null,
      videosOutsideMainChannel: videosOutside,
      publishedVideosOutsideMainChannel: publishedVideosOutside,
      commentsWithoutCreatorId: commentsNoId,
      commentsOutsideMainChannel: commentsOutside,
      paymentsOutsideMainChannel: paymentsOutside,
      subscriptionsOutsideMainChannel: subscriptionsOutside,
      primaryCreatorsCount: primaryCount,
      approvedCreatorsCount: approvedCount,
      totalCreatorsCount: totalCreators,
    };
  }

  static async applyMainChannelSetup(ctx: AppContext, adminUserId: string, confirmationPhrase: string) {
    const EXPECTED_PHRASE = "CONFIRM SETUP MAIN CHANNEL";
    if (confirmationPhrase !== EXPECTED_PHRASE) {
        throw new Error(`Invalid confirmation phrase. Expected: "${EXPECTED_PHRASE}"`);
    }

    const slug = flags.mainCreatorSlug;
    if (!slug) throw new Error("MAIN_CREATOR_SLUG not configured");

    let mainChannel = await ctx.prisma.creator.findUnique({ where: { slug } });

    if (!mainChannel) {
        const totalCreators = await ctx.prisma.creator.count();
        if (totalCreators > 0) {
            throw new Error(`There are ${totalCreators} existing creators but none matches the configured slug "${slug}". Silently renaming is prohibited.`);
        }

        mainChannel = await ctx.prisma.creator.create({
            data: {
                userId: adminUserId,
                slug,
                name: MAIN_CREATOR_NAME,
                isApproved: true,
                isPrimary: true,
            }
        });
    }

    await this.applyPrimaryRepair(ctx, mainChannel.id, "CONFIRM PRIMARY REPAIR");
    await this.applyOwnershipRepair(ctx, mainChannel.id, "CONFIRM OWNERSHIP REPAIR");

    await recordAuditEvent(ctx, {
        action: 'MAIN_CHANNEL_SETUP_APPLIED',
        targetType: 'CREATOR',
        targetId: mainChannel.id,
        metadata: { slug: mainChannel.slug }
    });

    return {
        action: 'MAIN_CHANNEL_SETUP_APPLIED',
        mainChannelId: mainChannel.id,
        slug: mainChannel.slug
    };
  }

  static async applyOwnershipRepair(ctx: AppContext, mainChannelId: string, confirmationPhrase: string) {
    const EXPECTED_PHRASE = "CONFIRM OWNERSHIP REPAIR";
    if (confirmationPhrase !== EXPECTED_PHRASE) {
        throw new Error(`Invalid confirmation phrase. Expected: "${EXPECTED_PHRASE}"`);
    }

    const [vCount, cCount, pCount, sCount] = await Promise.all([
      ctx.prisma.video.updateMany({
        where: { creatorId: { not: mainChannelId } },
        data: { creatorId: mainChannelId },
      }),
      ctx.prisma.comment.updateMany({
        where: { OR: [{ creatorId: null }, { creatorId: { not: mainChannelId } }] },
        data: { creatorId: mainChannelId },
      }),
      ctx.prisma.payment.updateMany({
        where: { creatorId: { not: mainChannelId } },
        data: { creatorId: mainChannelId },
      }),
      ctx.prisma.subscription.updateMany({
        where: { creatorId: { not: mainChannelId } },
        data: { creatorId: mainChannelId },
      }),
    ]);

    await recordAuditEvent(ctx, {
        action: 'MAIN_CHANNEL_OWNERSHIP_REPAIR',
        targetType: 'CREATOR',
        targetId: mainChannelId,
        metadata: {
            videosRepaired: vCount.count,
            commentsRepaired: cCount.count,
            paymentsRepaired: pCount.count,
            subscriptionsRepaired: sCount.count,
        }
    });

    return {
      videosRepaired: vCount.count,
      commentsRepaired: cCount.count,
      paymentsRepaired: pCount.count,
      subscriptionsRepaired: sCount.count,
    };
  }

  static async applyPrimaryRepair(ctx: AppContext, mainChannelId: string, confirmationPhrase: string) {
    const EXPECTED_PHRASE = "CONFIRM PRIMARY REPAIR";
    if (confirmationPhrase !== EXPECTED_PHRASE) {
        throw new Error(`Invalid confirmation phrase. Expected: "${EXPECTED_PHRASE}"`);
    }

    await ctx.prisma.creator.updateMany({
      where: { id: { not: mainChannelId }, isPrimary: true },
      data: { isPrimary: false },
    });

    await ctx.prisma.creator.update({
      where: { id: mainChannelId },
      data: { isPrimary: true, isApproved: true },
    });

    await recordAuditEvent(ctx, {
        action: 'MAIN_CHANNEL_PRIMARY_REPAIR',
        targetType: 'CREATOR',
        targetId: mainChannelId,
    });

    return { success: true };
  }
}
