import { AppContext } from "@/lib/modules/shared/app-context";
import { UserRepository } from "../infrastructure/user.repository";
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
    const repository = new UserRepository(ctx.prisma);
    const existingUser = await repository.findById(data.id);

    if (existingUser) {
      // Identity sync: preserves DB isPatron
      await repository.update(data.id, {
        email: data.email,
        name: data.name ?? existingUser.name,
        username: data.username ?? existingUser.username,
        imageUrl: data.imageUrl ?? existingUser.imageUrl,
        language: data.language ?? existingUser.language,
      });
    } else {
        // New user creation
        await repository.create({
          id: data.id,
          email: data.email,
          name: data.name,
          username: data.username,
          imageUrl: data.imageUrl,
          language: data.language || 'pl',
          referralCode: crypto.randomBytes(6).toString('hex'),
          isPatron: false, // Default is false, regardless of Clerk metadata
          role: 'USER',
        });
    }

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
