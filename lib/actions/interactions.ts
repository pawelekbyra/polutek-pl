'use server';

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { UserService } from "@/lib/services/user.service";
import { revalidatePath } from "next/cache";
import { INITIAL_VIDEOS, DEFAULT_CREATOR } from "@/lib/data/initial-content";

/**
 * Ensures a video and its creator exist in the DB before an interaction.
 * Useful for "auto-healing" when using fallback data on a fresh DB.
 */
async function ensureContentExists(videoId: string) {
  try {
    const video = await prisma.video.findUnique({ where: { id: videoId } });
    if (!video) {
        console.log(`[Interaction] Auto-healing: Video ${videoId} missing from DB. Creating from fallback.`);
        const fallback = INITIAL_VIDEOS.find(v => v.id === videoId);
        if (!fallback) return;

        // 1. Ensure Creator exists
        let creator = await prisma.creator.findUnique({ where: { slug: DEFAULT_CREATOR.slug } });
        if (!creator) {
            // Find or create admin user to link the creator to
            const adminUser = await UserService.ensureAdminUser().catch(() => null);
            if (!adminUser) throw new Error("Could not create admin user for auto-healing.");

            creator = await prisma.creator.create({
                data: {
                    id: DEFAULT_CREATOR.id,
                    userId: adminUser.id,
                    slug: DEFAULT_CREATOR.slug,
                    name: DEFAULT_CREATOR.name,
                    bio: DEFAULT_CREATOR.bio,
                    isApproved: true
                }
            });
        }

        // 2. Create Video
        await prisma.video.create({
            data: {
                id: fallback.id,
                creatorId: creator.id,
                title: fallback.title,
                slug: fallback.slug,
                description: fallback.description,
                videoUrl: fallback.videoUrl,
                thumbnailUrl: fallback.thumbnailUrl,
                duration: fallback.duration,
                tier: fallback.tier,
                isMainFeatured: fallback.isMainFeatured,
                views: fallback.views,
                likesCount: fallback.likesCount,
                dislikesCount: fallback.dislikesCount || 0,
                publishedAt: new Date()
            }
        });
    }
  } catch (e: any) {
    console.error("[Interaction] Auto-healing failed:", e.message);
  }
}

/**
 * Toggles a 'Like' on a video.
 */
export async function toggleVideoLike(videoId: string) {
  let userId: string | null = null;
  try {
      const authData = auth();
      userId = authData.userId;
  } catch (e: any) {
      console.error("[Interaction] Clerk Handshake Failed:", e.message);
      return { error: "CLERK_ERROR", message: "Błąd weryfikacji sesji (Clerk Handshake). Sprawdź klucze API w Vercel." };
  }

  if (!userId) return { error: "AUTH_REQUIRED" };

  try {
    // 0. Auto-healing check
    await ensureContentExists(videoId);

    // 1. Sync/Fetch user record
    try {
        await UserService.getOrCreateUser(userId);
    } catch (err: any) {
        console.error("[Interaction] UserService sync issue:", err.message);
        return { error: "USER_SYNC_FAILED", message: "Błąd synchronizacji profilu użytkownika. Spróbuj zalogować się ponownie." };
    }

    const result = await prisma.$transaction(async (tx) => {
      // 0. Double-check user exists WITHIN the transaction to prevent race conditions
      // and guarantee foreign key availability at the exact time of record creation.
      await tx.user.upsert({
          where: { id: userId! },
          update: {}, // No updates needed, just ensure existence
          create: {
              id: userId!,
              email: `user_${userId}@polutek.pl`, // Fallback email
              language: "pl",
              role: "USER"
          }
      });

      const existingDislike = await tx.videoDislike.findUnique({
        where: { userId_videoId: { userId: userId!, videoId } }
      });

      if (existingDislike) {
        await tx.videoDislike.delete({ where: { id: existingDislike.id } });
        await tx.video.update({
          where: { id: videoId },
          data: { dislikesCount: { decrement: 1 } }
        });
      }

      const existingLike = await tx.videoLike.findUnique({
        where: { userId_videoId: { userId: userId!, videoId } }
      });

      if (existingLike) {
        await tx.videoLike.delete({ where: { id: existingLike.id } });
        await tx.video.update({
          where: { id: videoId },
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
    if (error.code === 'P2021' || error.message?.includes("DATABASE_TABLES_MISSING") || error.message?.includes("P2021")) {
        return { error: "DATABASE_ERROR", message: "Baza danych nie jest gotowa (P2021). Uruchom 'npx prisma db push' w swoim środowisku." };
    }
    return { error: "INTERNAL_ERROR", message: error.message };
  }
}

/**
 * Toggles a 'Dislike' on a video.
 */
export async function toggleVideoDislike(videoId: string) {
  let userId: string | null = null;
  try {
      const authData = auth();
      userId = authData.userId;
  } catch (e: any) {
      console.error("[Interaction] Clerk Handshake Failed:", e.message);
      return { error: "CLERK_ERROR", message: "Błąd weryfikacji sesji (Clerk Handshake). Sprawdź klucze API w Vercel." };
  }

  if (!userId) return { error: "AUTH_REQUIRED" };

  try {
    await ensureContentExists(videoId);
    try {
        await UserService.getOrCreateUser(userId);
    } catch (err: any) {
        console.error("[Interaction] UserService sync issue:", err.message);
        return { error: "USER_SYNC_FAILED", message: "Błąd synchronizacji profilu użytkownika. Spróbuj zalogować się ponownie." };
    }

    const result = await prisma.$transaction(async (tx) => {
      // 0. Double-check user exists WITHIN the transaction
      await tx.user.upsert({
          where: { id: userId! },
          update: {},
          create: {
              id: userId!,
              email: `user_${userId}@polutek.pl`,
              language: "pl",
              role: "USER"
          }
      });

      const existingLike = await tx.videoLike.findUnique({
        where: { userId_videoId: { userId: userId!, videoId } }
      });

      if (existingLike) {
        await tx.videoLike.delete({ where: { id: existingLike.id } });
        await tx.video.update({
          where: { id: videoId },
          data: { likesCount: { decrement: 1 } }
        });
      }

      const existingDislike = await tx.videoDislike.findUnique({
        where: { userId_videoId: { userId: userId!, videoId } }
      });

      if (existingDislike) {
        await tx.videoDislike.delete({ where: { id: existingDislike.id } });
        await tx.video.update({
          where: { id: videoId },
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
    if (error.code === 'P2021' || error.message?.includes("DATABASE_TABLES_MISSING") || error.message?.includes("P2021")) {
        return { error: "DATABASE_ERROR", message: "Baza danych nie jest gotowa (P2021). Uruchom 'npx prisma db push' w swoim środowisku." };
    }
    return { error: "INTERNAL_ERROR", message: error.message };
  }
}
