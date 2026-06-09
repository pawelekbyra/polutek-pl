import { AppContext } from "@/lib/modules/shared/app-context";
import { logger } from "@/lib/logger";
import { recordAuditEvent } from "@/lib/modules/audit";
import { Prisma, PrismaClient } from "@prisma/client";
import crypto from 'crypto';

export interface SyncUserInput {
  id: string;
  email: string;
  name?: string | null;
  username?: string | null;
  imageUrl?: string | null;
  language?: string;
  referrerId?: string | null;
}

export class SyncUserUseCase {
  static async execute(ctx: AppContext, data: SyncUserInput) {
    const { prisma, actor } = ctx;
    const { id, email, name, username, imageUrl, language, referrerId } = data;

    try {
      return await (prisma as PrismaClient).$transaction(async (tx) => {
        const existingUserById = await tx.user.findUnique({
          where: { id },
          select: { id: true, role: true, email: true }
        });

        const existingUserByEmail = await tx.user.findUnique({
          where: { email },
          select: { id: true, role: true, email: true }
        });

        const isEmailConflict = existingUserByEmail && existingUserByEmail.id !== id;

        // 1. Resolve email conflict if necessary
        if (isEmailConflict) {
          logger.warn(`[SyncUserUseCase] Email conflict: ${email} is owned by ${existingUserByEmail.id}. Attempting to resolve.`);
          await tx.user.update({
            where: { id: existingUserByEmail.id },
            data: { email: `${existingUserByEmail.email}_stale_${Date.now()}` }
          });
        }

        // 2. Determine target role
        let targetRole: 'ADMIN' | 'USER' = 'USER';
        // In modular world, we might want a different check for admins,
        // but for now we'll keep the logic that admins are hardcoded or preserved.
        // We can't easily import UserAdminService here without circular deps if it's legacy.
        // For now, let's use the role from existing record if it exists.
        if (existingUserById) {
          targetRole = existingUserById.role as 'ADMIN' | 'USER';
        }

        const updateData: Prisma.UserUpdateInput = {
          email,
          language: language || 'pl',
          role: targetRole,
        };

        if (name) updateData.name = name;
        if (username) updateData.username = username;
        if (imageUrl) updateData.imageUrl = imageUrl;

        // Referral linking for NEW users
        if (referrerId && !existingUserById) {
          const referrer = await tx.user.findUnique({
            where: { id: referrerId },
            select: { id: true }
          });
          if (referrer && referrer.id !== id) {
            updateData.referredBy = { connect: { id: referrer.id } };
          }
        }

        const user = await tx.user.upsert({
          where: { id },
          update: updateData,
          create: {
            id,
            email,
            name,
            username,
            imageUrl,
            role: targetRole,
            language: language || 'pl',
            referralCode: crypto.randomBytes(6).toString('hex'),
            referredBy: updateData.referredBy ? (updateData.referredBy as Prisma.UserCreateNestedOneWithoutReferralsInput) : undefined,
          }
        });

        // 3. Repoint records if there was a conflict
        if (isEmailConflict) {
          const oldId = existingUserByEmail.id;
          await this.repointRecords(tx, oldId, id);
          logger.info(`[SyncUserUseCase] Merged records from ${oldId} to ${id} due to email conflict (${email})`);

          await recordAuditEvent(ctx, {
            action: 'USER_MERGE',
            metadata: {
              reason: `Email conflict resolved: ${email}`,
              oldId,
              newId: id
            }
          }, tx);
        }

        return user;
      }, { timeout: 30000 });
    } catch (error) {
      logger.error("[SyncUserUseCase] Error during sync:", error);
      throw error;
    }
  }

  private static async repointRecords(tx: Prisma.TransactionClient, oldId: string, newId: string) {
    // Comments
    await tx.comment.updateMany({
      where: { authorId: oldId },
      data: { authorId: newId }
    });

    // Comment Reactions
    const oldReactions = await tx.commentReaction.findMany({ where: { userId: oldId } });
    for (const reaction of oldReactions) {
      await tx.commentReaction.upsert({
        where: { userId_commentId: { userId: newId, commentId: reaction.commentId } },
        update: {},
        create: { userId: newId, commentId: reaction.commentId, type: reaction.type, createdAt: reaction.createdAt }
      });
    }
    await tx.commentReaction.deleteMany({ where: { userId: oldId } });

    // Comment Reports
    const oldReports = await tx.commentReport.findMany({ where: { reporterId: oldId } });
    for (const report of oldReports) {
      await tx.commentReport.upsert({
        where: { commentId_reporterId: { commentId: report.commentId, reporterId: newId } },
        update: {},
        create: {
          commentId: report.commentId,
          reporterId: newId,
          reason: report.reason,
          note: report.note,
          status: report.status,
          createdAt: report.createdAt
        }
      });
    }
    await tx.commentReport.deleteMany({ where: { reporterId: oldId } });

    // Legacy Comment Likes/Dislikes
    await tx.commentLike.deleteMany({
      where: { userId: newId, commentId: { in: (await tx.commentLike.findMany({ where: { userId: oldId }, select: { commentId: true } })).map(l => l.commentId) } }
    });
    await tx.commentLike.updateMany({ where: { userId: oldId }, data: { userId: newId } });

    await tx.commentDislike.deleteMany({
      where: { userId: newId, commentId: { in: (await tx.commentDislike.findMany({ where: { userId: oldId }, select: { commentId: true } })).map(d => d.commentId) } }
    });
    await tx.commentDislike.updateMany({ where: { userId: oldId }, data: { userId: newId } });

    // Audit Logs
    await tx.auditLog.updateMany({ where: { actorUserId: oldId }, data: { actorUserId: newId } });

    // Payments
    await tx.payment.updateMany({ where: { userId: oldId }, data: { userId: newId } });

    // UserPaymentTotals
    const oldTotals = await tx.userPaymentTotal.findMany({ where: { userId: oldId } });
    for (const total of oldTotals) {
      await tx.userPaymentTotal.upsert({
        where: { userId_currency: { userId: newId, currency: total.currency } },
        update: {
          amountMinor: { increment: total.amountMinor },
        },
        create: {
          userId: newId,
          currency: total.currency,
          amountMinor: total.amountMinor,
        }
      });
    }
    await tx.userPaymentTotal.deleteMany({ where: { userId: oldId } });

    // PatronGrants
    await tx.patronGrant.updateMany({ where: { userId: oldId }, data: { userId: newId } });

    // Subscriptions
    const oldSubs = await tx.subscription.findMany({ where: { userId: oldId } });
    for (const sub of oldSubs) {
      await tx.subscription.upsert({
        where: { userId_creatorId: { userId: newId, creatorId: sub.creatorId } },
        update: {},
        create: { userId: newId, creatorId: sub.creatorId, createdAt: sub.createdAt }
      });
    }
    await tx.subscription.deleteMany({ where: { userId: oldId } });

    // Referrals
    await tx.referral.updateMany({ where: { referrerId: oldId }, data: { referrerId: newId } });
    await tx.referral.updateMany({ where: { referredId: oldId }, data: { referredId: newId } });
  }
}
