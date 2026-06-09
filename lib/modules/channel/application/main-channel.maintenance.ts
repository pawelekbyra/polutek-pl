import { VideoStatus, Prisma, PrismaClient } from '@prisma/client';
import { AppContext } from '@/lib/modules/shared/app-context';
import { recordAuditEvent } from '@/lib/modules/audit';
import { AppError } from '@/lib/modules/shared/app-error';
import { flags } from '@/lib/feature-flags';
import { MAIN_CREATOR_NAME } from '@/lib/constants';
import { WriteTx } from '@/lib/modules/shared/db';

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
    const db = ctx.prisma as PrismaClient;
    const mainChannel = slug ? await db.creator.findUnique({ where: { slug } }) : null;
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
      db.video.count({ where: mainChannelId ? { creatorId: { not: mainChannelId } } : {} }),
      db.video.count({
        where: {
          status: VideoStatus.PUBLISHED,
          ...(mainChannelId ? { creatorId: { not: mainChannelId } } : {})
        }
      }),
      db.comment.count({ where: { creatorId: null } }),
      db.comment.count({ where: mainChannelId ? { creatorId: { not: mainChannelId } } : {} }),
      db.payment.count({ where: mainChannelId ? { creatorId: { not: mainChannelId } } : {} }),
      db.subscription.count({ where: mainChannelId ? { creatorId: { not: mainChannelId } } : {} }),
      db.creator.count({ where: { isPrimary: true } }),
      db.creator.count({ where: { isApproved: true } }),
      db.creator.count(),
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

  static async applyMainChannelSetup(ctx: AppContext, confirmationPhrase: string) {
    const EXPECTED_PHRASE = "CONFIRM SETUP MAIN CHANNEL";
    if (confirmationPhrase !== EXPECTED_PHRASE) {
        throw new AppError(`Invalid confirmation phrase. Expected: "${EXPECTED_PHRASE}"`, 400, "INVALID_CONFIRMATION_PHRASE");
    }

    if (ctx.actor.type !== 'admin') {
        throw new AppError("Only admins can perform main channel setup", 403, "FORBIDDEN");
    }

    const slug = flags.mainCreatorSlug;
    if (!slug) throw new AppError("MAIN_CREATOR_SLUG not configured", 500, "MAINTENANCE_ERROR");

    const result = await (ctx.prisma as PrismaClient).$transaction(async (tx) => {
        let mainChannel = await tx.creator.findUnique({ where: { slug } });

        if (!mainChannel) {
            const totalCreators = await tx.creator.count();
            if (totalCreators > 0) {
                throw new AppError(`There are ${totalCreators} existing creators but none matches the configured slug "${slug}". Silently renaming is prohibited.`, 400, "MAINTENANCE_ERROR");
            }

            const userId = ctx.actor.type !== 'guest' && 'userId' in ctx.actor ? ctx.actor.userId : null;
            if (!userId) {
                throw new AppError("Cannot create main channel without a valid user actor", 400, "MAINTENANCE_ERROR");
            }

            mainChannel = await tx.creator.create({
                data: {
                    userId: userId,
                    slug,
                    name: MAIN_CREATOR_NAME,
                    isApproved: true,
                    isPrimary: true,
                }
            });
        }

        await this.applyPrimaryRepairInternal(tx, mainChannel.id);
        await this.applyOwnershipRepairInternal(tx, mainChannel.id);

        await recordAuditEvent(ctx, {
            action: 'MAIN_CHANNEL_SETUP_APPLIED',
            targetType: 'CREATOR',
            targetId: mainChannel.id,
            metadata: { slug: mainChannel.slug }
        }, tx);

        return {
            mainChannelId: mainChannel.id,
            slug: mainChannel.slug
        };
    });

    return {
        action: 'MAIN_CHANNEL_SETUP_APPLIED',
        ...result
    };
  }

  static async applyOwnershipRepair(ctx: AppContext, mainChannelId: string, confirmationPhrase: string) {
    const EXPECTED_PHRASE = "CONFIRM OWNERSHIP REPAIR";
    if (confirmationPhrase !== EXPECTED_PHRASE) {
        throw new AppError(`Invalid confirmation phrase. Expected: "${EXPECTED_PHRASE}"`, 400, "INVALID_CONFIRMATION_PHRASE");
    }

    if (ctx.actor.type !== 'admin') {
        throw new AppError("Only admins can perform ownership repair", 403, "FORBIDDEN");
    }

    const result = await (ctx.prisma as PrismaClient).$transaction(async (tx) => {
        const stats = await this.applyOwnershipRepairInternal(tx, mainChannelId);

        await recordAuditEvent(ctx, {
            action: 'MAIN_CHANNEL_OWNERSHIP_REPAIR',
            targetType: 'CREATOR',
            targetId: mainChannelId,
            metadata: stats
        }, tx);

        return stats;
    });

    return result;
  }

  private static async applyOwnershipRepairInternal(tx: WriteTx, mainChannelId: string) {
    const [vCount, cCount, pCount, sCount] = await Promise.all([
      tx.video.updateMany({
        where: { creatorId: { not: mainChannelId } },
        data: { creatorId: mainChannelId },
      }),
      tx.comment.updateMany({
        where: { OR: [{ creatorId: null }, { creatorId: { not: mainChannelId } }] },
        data: { creatorId: mainChannelId },
      }),
      tx.payment.updateMany({
        where: { creatorId: { not: mainChannelId } },
        data: { creatorId: mainChannelId },
      }),
      tx.subscription.updateMany({
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

  static async applyPrimaryRepair(ctx: AppContext, mainChannelId: string, confirmationPhrase: string) {
    const EXPECTED_PHRASE = "CONFIRM PRIMARY REPAIR";
    if (confirmationPhrase !== EXPECTED_PHRASE) {
        throw new AppError(`Invalid confirmation phrase. Expected: "${EXPECTED_PHRASE}"`, 400, "INVALID_CONFIRMATION_PHRASE");
    }

    if (ctx.actor.type !== 'admin') {
        throw new AppError("Only admins can perform primary repair", 403, "FORBIDDEN");
    }

    await (ctx.prisma as PrismaClient).$transaction(async (tx) => {
        await this.applyPrimaryRepairInternal(tx, mainChannelId);

        await recordAuditEvent(ctx, {
            action: 'MAIN_CHANNEL_PRIMARY_REPAIR',
            targetType: 'CREATOR',
            targetId: mainChannelId,
        }, tx);
    });

    return { success: true };
  }

  private static async applyPrimaryRepairInternal(tx: WriteTx, mainChannelId: string) {
    await tx.creator.updateMany({
      where: { id: { not: mainChannelId }, isPrimary: true },
      data: { isPrimary: false },
    });

    await tx.creator.update({
      where: { id: mainChannelId },
      data: { isPrimary: true, isApproved: true },
    });
  }
}
