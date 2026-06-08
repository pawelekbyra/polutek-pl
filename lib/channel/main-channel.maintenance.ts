import { prisma } from '@/lib/prisma';
import { VideoStatus, Prisma } from '@prisma/client';
import { MainChannelSetupPreview } from './main-channel.types';
import { MainChannelService } from './main-channel.service';
import { AmbiguousMainChannelSetupError } from './main-channel.errors';
import { MAIN_CREATOR_NAME } from '@/lib/constants';

type PrismaExecutor = Prisma.TransactionClient | typeof prisma;

export class MainChannelMaintenance {
  static async previewMainChannelSetup(): Promise<MainChannelSetupPreview> {
    const slug = MainChannelService.getConfiguredSlug();
    const mainChannel = await prisma.creator.findUnique({ where: { slug } });
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
      prisma.video.count({ where: mainChannelId ? { creatorId: { not: mainChannelId } } : {} }),
      prisma.video.count({
        where: {
          status: VideoStatus.PUBLISHED,
          ...(mainChannelId ? { creatorId: { not: mainChannelId } } : {})
        }
      }),
      prisma.comment.count({ where: { creatorId: null } }),
      prisma.comment.count({ where: mainChannelId ? { creatorId: { not: mainChannelId } } : {} }),
      prisma.payment.count({ where: mainChannelId ? { creatorId: { not: mainChannelId } } : {} }),
      prisma.subscription.count({ where: mainChannelId ? { creatorId: { not: mainChannelId } } : {} }),
      prisma.creator.count({ where: { isPrimary: true } }),
      prisma.creator.count({ where: { isApproved: true } }),
      prisma.creator.count(),
    ]);

    return {
      mainChannelId,
      mainChannelSlug: slug,
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

  static async applyMainChannelSetup(adminUserId: string, confirm: boolean, db: PrismaExecutor = prisma) {
    if (!confirm) throw new Error("Explicit confirmation required for setup apply.");

    const slug = MainChannelService.getConfiguredSlug();
    let mainChannel = await db.creator.findUnique({ where: { slug } });

    if (!mainChannel) {
        const totalCreators = await db.creator.count();
        if (totalCreators > 0) {
            throw new AmbiguousMainChannelSetupError(`There are ${totalCreators} existing creators but none matches the configured slug "${slug}". Silently renaming is prohibited.`);
        }

        mainChannel = await db.creator.create({
            data: {
                userId: adminUserId,
                slug,
                name: MAIN_CREATOR_NAME,
                isApproved: true,
                isPrimary: true,
            }
        });
    }

    await this.applyPrimaryRepair(mainChannel.id, true, db);
    await this.applyOwnershipRepair(mainChannel.id, true, db);

    // TODO: Write Audit Log when Audit model is available or use existing service
    // For now returning structured data
    return {
        action: 'MAIN_CHANNEL_SETUP_APPLIED',
        mainChannelId: mainChannel.id,
        slug: mainChannel.slug
    };
  }

  static async applyOwnershipRepair(mainChannelId: string, confirm: boolean, db: PrismaExecutor = prisma) {
    if (!confirm) throw new Error("Explicit confirmation required for ownership repair.");

    const [vCount, cCount, pCount, sCount] = await Promise.all([
      db.video.updateMany({
        where: { creatorId: { not: mainChannelId } },
        data: { creatorId: mainChannelId },
      }),
      db.comment.updateMany({
        where: { OR: [{ creatorId: null }, { creatorId: { not: mainChannelId } }] },
        data: { creatorId: mainChannelId },
      }),
      db.payment.updateMany({
        where: { creatorId: { not: mainChannelId } },
        data: { creatorId: mainChannelId },
      }),
      db.subscription.updateMany({
        where: { creatorId: { not: mainChannelId } },
        data: { creatorId: mainChannelId },
      }),
    ]);

    return {
      videosRepaired: vCount.count,
      commentsRepaired: cCount.count,
      paymentsRepaired: pCount.count,
      subscriptionsRepaired: sCount.count,
    };
  }

  static async applyPrimaryRepair(mainChannelId: string, confirm: boolean, db: PrismaExecutor = prisma) {
    if (!confirm) throw new Error("Explicit confirmation required for primary repair.");

    await db.creator.updateMany({
      where: { id: { not: mainChannelId }, isPrimary: true },
      data: { isPrimary: false },
    });

    await db.creator.update({
      where: { id: mainChannelId },
      data: { isPrimary: true, isApproved: true },
    });

    return { success: true };
  }
}
