'use server';

import { auth } from '@clerk/nextjs/server';
import { UserService } from '@/lib/services/user.service';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { flags } from '@/lib/feature-flags';
import { logger } from '@/lib/logger';
import { DEFAULT_CREATOR } from '@/lib/data/initial-content';

/**
 * Ensures a creator exists in the DB before subscribing.
 */
async function ensureCreatorExists(creatorId: string) {
  if (process.env.NODE_ENV === 'production') return;

  try {
    const creator = await prisma.creator.findUnique({ where: { id: creatorId } });
    if (!creator && creatorId === DEFAULT_CREATOR.id) {
      logger.info(`[Subscription] Auto-healing: Creator ${creatorId} missing. Ensuring admin.`);
      const adminUser = await UserService.ensureAdminUser().catch(() => null);
      if (!adminUser) return;

      await prisma.creator.create({
        data: {
          id: DEFAULT_CREATOR.id,
          userId: adminUser.id,
          slug: flags.mainCreatorSlug,
          name: 'Paweł Perfect',
          isApproved: true
        }
      });
    }
  } catch (e) {
    logger.error("[Subscription] Auto-healing failed:", e);
  }
}

export async function toggleSubscriptionAction(creatorId: string) {
  let userId: string | null = null;
  try {
    const authData = await auth();
    userId = authData.userId;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown Clerk auth error';
    logger.error("[Subscription] Clerk Handshake Failed:", message);
    return { error: "CLERK_ERROR", message: "Błąd weryfikacji sesji (Clerk Handshake). Sprawdź klucze API." };
  }

  if (!userId) return { error: 'AUTH_REQUIRED' };

  try {
    await ensureCreatorExists(creatorId);
    const result = await UserService.toggleSubscription(userId, creatorId);
    revalidatePath('/', 'layout');
    return { success: true, isSubscribed: result.isSubscribed };
  } catch (error) {
    logger.error("[TOGGLE_SUBSCRIPTION_ACTION_ERROR]", error);
    return { error: error instanceof Error ? error.message : 'INTERNAL_ERROR' };
  }
}

export async function getSubscriptionStatusAction(creatorId: string) {
  let userId: string | null = null;
  try {
    const authData = await auth();
    userId = authData.userId;
  } catch (e) {
    return { isSubscribed: false };
  }

  if (!userId) return { isSubscribed: false };

  try {
    const isSubscribed = await UserService.isSubscribed(userId, creatorId);
    return { isSubscribed };
  } catch (error) {
    logger.error("[GET_SUBSCRIPTION_STATUS_ERROR]", error);
    return { isSubscribed: false };
  }
}
