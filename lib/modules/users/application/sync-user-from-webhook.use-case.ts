import { AppContext } from "@/lib/modules/shared/app-context";
import { EmailService } from "@/lib/services/email.service"; // R5/R9 boundary: legacy email service
import { AccountDeletionCleanupUseCase } from "./account-deletion-cleanup.use-case";
import crypto from 'crypto';
import { isGeneratedClerkUsername } from "@/lib/utils/auth";
import { WebhookEventStatus } from "@prisma/client";

export interface WebhookUserSyncData {
  id: string;
  email: string;
  name?: string | null;
  username?: string | null;
  imageUrl?: string | null;
  language?: string;
}

/**
 * SyncUserFromWebhookUseCase handles identity and profile synchronization from Clerk.
 *
 * IMPORTANT: This use case synchronizes CACHE and IDENTITY data.
 * It must NOT grant or revoke patron status (isPatron) as the final source of truth.
 * Patron status transitions belong to the R7 Patron + Payments module.
 */
export class SyncUserFromWebhookUseCase {
  static async execute(ctx: AppContext, data: WebhookUserSyncData, eventType: string): Promise<void> {
    await ctx.db.writeTransaction(async (tx) => {
      const existingUser = await tx.user.findUnique({ where: { id: data.id } });
      const conflictingEmailUser = await tx.user.findUnique({
        where: { email: data.email },
        select: { id: true, email: true, isDeleted: true },
      });
      const isEmailConflict = Boolean(conflictingEmailUser && conflictingEmailUser.id !== data.id);

      if (isEmailConflict && conflictingEmailUser) {
        await tx.user.update({
          where: { id: conflictingEmailUser.id },
          data: { email: `${conflictingEmailUser.email}_stale_${Date.now()}` },
        });
      }

      if (existingUser) {
        // Identity sync: preserves DB isPatron and reactivates the same Clerk id after a previous tombstone.
        await tx.user.update({
          where: { id: data.id },
          data: {
            email: data.email,
            name: data.name ?? existingUser.name,
            username: data.username ?? existingUser.username,
            imageUrl: data.imageUrl ?? existingUser.imageUrl,
            language: data.language ?? existingUser.language,
            isDeleted: false,
          },
        });
      } else {
        // New user creation
        await tx.user.create({
          data: {
            id: data.id,
            email: data.email,
            name: data.name,
            username: data.username,
            imageUrl: data.imageUrl,
            language: data.language || 'pl',
            referralCode: crypto.randomBytes(6).toString('hex'),
            isPatron: false, // Default is false, regardless of Clerk metadata
            role: 'USER',
          },
        });
      }

      if (isEmailConflict && conflictingEmailUser && !conflictingEmailUser.isDeleted) {
        const oldSubs = await tx.subscription.findMany({
          where: { userId: conflictingEmailUser.id },
          select: { creatorId: true },
        });
        await tx.subscription.deleteMany({ where: { userId: conflictingEmailUser.id } });
        await tx.emailPreference.deleteMany({ where: { userId: conflictingEmailUser.id } });
        for (const sub of oldSubs) {
          const activeCount = await tx.subscription.count({ where: { creatorId: sub.creatorId } });
          await tx.creator.updateMany({ where: { id: sub.creatorId }, data: { subscribersCount: activeCount } });
        }
      }
    });

    // Handle side effects (R5/R9 boundary)
    if (eventType === 'user.created') {
        await EmailService.sendWelcomeEmail(data.email, data.name || undefined, data.language as any).catch(e => {
            console.error('[ClerkWebhook] Failed to send welcome email:', e);
        });
    }
  }

  /**
   * softDelete handles user anonymization via the shared account deletion cleanup use-case.
   * Missing/already-deleted local users are treated as successful idempotent cleanup.
   */
  static async softDelete(ctx: AppContext, userId: string): Promise<void> {
    await AccountDeletionCleanupUseCase.execute(ctx, {
      userId,
      source: 'CLERK_WEBHOOK',
      reason: 'Clerk user.deleted webhook',
    });
  }

  static async updatePassword(ctx: AppContext, userId: string): Promise<void> {
      const user = await ctx.prisma.user.findUnique({
          where: { id: userId },
          select: { email: true }
      });
      if (user?.email) {
          await EmailService.sendPasswordChangedEmail(user.email).catch(e => {
              console.error('[ClerkWebhook] Failed to send password changed email:', e);
          });
      }
  }

  static async finalizeEvent(ctx: AppContext, svixId: string, status: WebhookEventStatus, error?: string): Promise<void> {
      await ctx.prisma.clerkEvent.update({
          where: { id: svixId },
          data: {
              status,
              processedAt: status === WebhookEventStatus.PROCESSED ? new Date() : undefined,
              error: error || null
          }
      });
  }
}
