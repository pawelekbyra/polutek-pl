'use server';

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { UserService } from "@/lib/services/user.service";
import { revalidatePath } from "next/cache";
import { AccessPolicy } from "@/lib/access/access-policy";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Toggles a 'Like' on a video.
 */
export async function toggleVideoLike(videoId: string) {
  let userId: string | null = null;
  try {
      const authData = await auth();
      userId = authData.userId;
  } catch (e: any) {
      console.error("[Interaction] Clerk Handshake Failed:", e.message);
      return { error: "CLERK_ERROR", message: "Błąd weryfikacji sesji." };
  }

  if (!userId) return { error: "AUTH_REQUIRED" };

  // Rate limiting for reactions
  const rateLimitResult = await rateLimit({
    key: `video-reaction:${userId}`,
    limit: 10,
    windowMs: 60 * 1000
  });

  if (!rateLimitResult.success) {
    return { error: "TOO_MANY_REQUESTS", message: "Zbyt wiele reakcji. Spróbuj za chwilę." };
  }

  const decision = await AccessPolicy.canReactToVideo(userId, videoId);
  if (!decision.allowed) return { error: "FORBIDDEN", message: decision.reason };

  try {
    // 1. Sync/Fetch user record
    try {
        await UserService.getOrCreateUser(userId);
    } catch (err: any) {
        console.error("[Interaction] UserService sync issue:", err.message);
        return { error: "USER_SYNC_FAILED", message: "Błąd synchronizacji profilu użytkownika." };
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
  } catch (error: any) {
    console.error("[TOGGLE_LIKE_ERROR]", error);
    return { error: "INTERNAL_ERROR", message: "Wystąpił błąd." };
  }
}

/**
 * Toggles a 'Dislike' on a video.
 */
export async function toggleVideoDislike(videoId: string) {
  let userId: string | null = null;
  try {
      const authData = await auth();
      userId = authData.userId;
  } catch (e: any) {
      console.error("[Interaction] Clerk Handshake Failed:", e.message);
      return { error: "CLERK_ERROR", message: "Błąd weryfikacji sesji." };
  }

  if (!userId) return { error: "AUTH_REQUIRED" };

  // Rate limiting for reactions
  const rateLimitResult = await rateLimit({
    key: `video-reaction:${userId}`,
    limit: 10,
    windowMs: 60 * 1000
  });

  if (!rateLimitResult.success) {
    return { error: "TOO_MANY_REQUESTS", message: "Zbyt wiele reakcji. Spróbuj za chwilę." };
  }

  const decision = await AccessPolicy.canReactToVideo(userId, videoId);
  if (!decision.allowed) return { error: "FORBIDDEN", message: decision.reason };

  try {
    try {
        await UserService.getOrCreateUser(userId);
    } catch (err: any) {
        console.error("[Interaction] UserService sync issue:", err.message);
        return { error: "USER_SYNC_FAILED", message: "Błąd synchronizacji profilu użytkownika." };
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
  } catch (error: any) {
    console.error("[TOGGLE_DISLIKE_ERROR]", error);
    return { error: "INTERNAL_ERROR", message: "Wystąpił błąd." };
  }
}
