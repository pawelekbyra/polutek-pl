'use server';

import { logger } from "@/lib/logger";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { GetOrCreateUserUseCase } from "@/lib/modules/users";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { revalidatePath } from "next/cache";
import { AccessPolicy } from "@/lib/access/access-policy";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isDatabaseTableMissingError(error: unknown) {
  if (error instanceof Error && error.message.includes("DATABASE_TABLES_MISSING")) return true;
  if (error instanceof Error && error.message.includes("P2021")) return true;
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2021";
}

/**
 * Toggles a 'Like' on a video.
 */
export async function toggleVideoLike(videoId: string) {
  let userId: string | null = null;
  let sessionClaims: Record<string, unknown> | null | undefined = null;
  try {
      const authData = await auth();
      userId = authData.userId;
      sessionClaims = authData.sessionClaims;
  } catch (e: unknown) {
      logger.error("[Interaction] Clerk Handshake Failed:", getErrorMessage(e));
      return { error: "CLERK_ERROR", message: "Błąd weryfikacji sesji (Clerk Handshake). Sprawdź klucze API w Vercel." };
  }

  if (!userId) return { error: "AUTH_REQUIRED" };

  const decision = await AccessPolicy.canReactToVideo(userId, videoId);
  if (!decision.allowed) return { error: "FORBIDDEN", message: decision.reason };

  try {
    // 1. Sync/Fetch user record
    try {
        const actor = await getActorFromAuth();
        const ctx = createAppContext({ actor });
        const email = (sessionClaims as any)?.email as string;
        await GetOrCreateUserUseCase.execute(ctx, {
            id: userId,
            email,
            name: (sessionClaims as any)?.name,
            username: (sessionClaims as any)?.username,
            imageUrl: (sessionClaims as any)?.image_url || (sessionClaims as any)?.picture,
        });
    } catch (err: unknown) {
        logger.error("[Interaction] UserService sync issue:", getErrorMessage(err));
        return { error: "USER_SYNC_FAILED", message: "Błąd synchronizacji profilu użytkownika. Spróbuj zalogować się ponownie." };
    }

    const result = await prisma.$transaction(async (tx) => {
      // 0. Check user exists
      const user = await tx.user.findUnique({ where: { id: userId! } });
      if (!user) throw new Error("USER_NOT_FOUND");

      const existingDislike = await tx.videoDislike.findUnique({
        where: { userId_videoId: { userId: userId!, videoId } }
      });

      if (existingDislike) {
        await tx.videoDislike.delete({ where: { id: existingDislike.id } });
        await tx.video.updateMany({
          where: { id: videoId, dislikesCount: { gt: 0 } },
          data: { dislikesCount: { decrement: 1 } }
        });
      }

      const existingLike = await tx.videoLike.findUnique({
        where: { userId_videoId: { userId: userId!, videoId } }
      });

      if (existingLike) {
        await tx.videoLike.delete({ where: { id: existingLike.id } });
        await tx.video.updateMany({
          where: { id: videoId, likesCount: { gt: 0 } },
          data: { likesCount: { decrement: 1 } }
        });
        return { liked: false, disliked: false };
      } else {
        await tx.videoLike.create({ data: { userId: userId!, videoId } });
        await tx.video.update({
          where: { id: videoId },
          data: { likesCount: { increment: 1 } }
        });
        return { liked: true, disliked: false };
      }
    });

    revalidatePath('/', 'layout');
    return result;
  } catch (error: unknown) {
    logger.error("[TOGGLE_LIKE_ERROR]", error);
    if (isDatabaseTableMissingError(error)) {
        return { error: "DATABASE_ERROR", message: "Baza danych nie jest gotowa (P2021). Uruchom 'npx prisma migrate deploy' z aktualnymi migracjami." };
    }
    return { error: "INTERNAL_ERROR", message: getErrorMessage(error) };
  }
}

/**
 * Toggles a 'Dislike' on a video.
 */
export async function toggleVideoDislike(videoId: string) {
  let userId: string | null = null;
  let sessionClaims: Record<string, unknown> | null | undefined = null;
  try {
      const authData = await auth();
      userId = authData.userId;
      sessionClaims = authData.sessionClaims;
  } catch (e: unknown) {
      logger.error("[Interaction] Clerk Handshake Failed:", getErrorMessage(e));
      return { error: "CLERK_ERROR", message: "Błąd weryfikacji sesji (Clerk Handshake). Sprawdź klucze API w Vercel." };
  }

  if (!userId) return { error: "AUTH_REQUIRED" };

  const decision = await AccessPolicy.canReactToVideo(userId, videoId);
  if (!decision.allowed) return { error: "FORBIDDEN", message: decision.reason };

  try {
    try {
        const actor = await getActorFromAuth();
        const ctx = createAppContext({ actor });
        const email = (sessionClaims as any)?.email as string;
        await GetOrCreateUserUseCase.execute(ctx, {
            id: userId,
            email,
            name: (sessionClaims as any)?.name,
            username: (sessionClaims as any)?.username,
            imageUrl: (sessionClaims as any)?.image_url || (sessionClaims as any)?.picture,
        });
    } catch (err: unknown) {
        logger.error("[Interaction] UserService sync issue:", getErrorMessage(err));
        return { error: "USER_SYNC_FAILED", message: "Błąd synchronizacji profilu użytkownika. Spróbuj zalogować się ponownie." };
    }

    const result = await prisma.$transaction(async (tx) => {
      // 0. Check user exists
      const user = await tx.user.findUnique({ where: { id: userId! } });
      if (!user) throw new Error("USER_NOT_FOUND");

      const existingLike = await tx.videoLike.findUnique({
        where: { userId_videoId: { userId: userId!, videoId } }
      });

      if (existingLike) {
        await tx.videoLike.delete({ where: { id: existingLike.id } });
        await tx.video.updateMany({
          where: { id: videoId, likesCount: { gt: 0 } },
          data: { likesCount: { decrement: 1 } }
        });
      }

      const existingDislike = await tx.videoDislike.findUnique({
        where: { userId_videoId: { userId: userId!, videoId } }
      });

      if (existingDislike) {
        await tx.videoDislike.delete({ where: { id: existingDislike.id } });
        await tx.video.updateMany({
          where: { id: videoId, dislikesCount: { gt: 0 } },
          data: { dislikesCount: { decrement: 1 } }
        });
        return { liked: false, disliked: false };
      } else {
        await tx.videoDislike.create({ data: { userId: userId!, videoId } });
        await tx.video.update({
          where: { id: videoId },
          data: { dislikesCount: { increment: 1 } }
        });
        return { liked: false, disliked: true };
      }
    });

    revalidatePath('/', 'layout');
    return result;
  } catch (error: unknown) {
    logger.error("[TOGGLE_DISLIKE_ERROR]", error);
    if (isDatabaseTableMissingError(error)) {
        return { error: "DATABASE_ERROR", message: "Baza danych nie jest gotowa (P2021). Uruchom 'npx prisma migrate deploy' z aktualnymi migracjami." };
    }
    return { error: "INTERNAL_ERROR", message: getErrorMessage(error) };
  }
}
