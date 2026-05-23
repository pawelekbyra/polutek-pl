import { prisma } from '@/lib/prisma';
import { currentUser, clerkClient } from '@clerk/nextjs/server';
import crypto from 'crypto';
import { SchemaService } from './schema.service';

export class UserService {
  static readonly ADMIN_EMAIL = "pawel.perfect@gmail.com";

  /**
   * Primary entry point for ensuring a user exists and is up to date.
   * Handles Clerk integration, ID mapping, and local DB sync.
   */
  static async getOrCreateUser(clerkUserId: string) {
    try {
      const clerkUser = await currentUser();

      // Fallback if Clerk API is unavailable but we have an ID
      if (!clerkUser || clerkUser.id !== clerkUserId) {
          const local = await prisma.user.findUnique({ where: { id: clerkUserId } });
          if (local) return local;
          if (!clerkUser) throw new Error("CLERK_USER_NOT_FOUND");
      }

      const email = clerkUser.primaryEmailAddress?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress;
      if (!email) throw new Error("USER_HAS_NO_EMAIL");

      const name = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || null;
      const imageUrl = clerkUser.imageUrl || null;
      const username = clerkUser.username || null;

      // Metadata extraction
      const publicMeta = clerkUser.publicMetadata as any;
      const unsafeMeta = clerkUser.unsafeMetadata as any;
      const language = publicMeta.language || publicMeta.preferredLanguage || unsafeMeta.language || unsafeMeta.preferredLanguage || 'en';
      const referrerId = unsafeMeta.referrerId || null;

      return await this.syncUser(clerkUserId, email, name, imageUrl, referrerId, language, username);
    } catch (e: any) {
      console.error("[UserService.getOrCreateUser]", e.message);

      // AUTO-HEALING: If database columns are missing, trigger a comprehensive heal
      if (e.message?.includes("does not exist") || e.code === 'P2021') {
          console.log("[UserService] Missing columns detected. Healing database schema...");
          await SchemaService.ensureSchema();
          // One-time retry after healing
          return await prisma.user.findUnique({ where: { id: clerkUserId } });
      }
      throw e;
    }
  }

  /**
   * Atomic synchronization logic. Handles upserts and email conflict migrations.
   */
  static async syncUser(id: string, email: string, name?: string | null, imageUrl?: string | null, referrerId?: string | null, language?: string, username?: string | null) {
    const role = email.toLowerCase() === UserService.ADMIN_EMAIL.toLowerCase() ? 'ADMIN' : 'USER';

    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Resolve potential email conflicts (Clerk ID change or duplicate accounts)
        const existingByEmail = await tx.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' }, id: { not: id } }
        });

        if (existingByEmail) {
          console.log(`[UserService] Migrating data for ${email} from ${existingByEmail.id} to ${id}`);
          // Temporarily rename conflict to free up the email unique constraint
          await tx.user.update({
            where: { id: existingByEmail.id },
            data: {
              email: `old_${existingByEmail.id}_${Date.now()}@temp.temp`,
              stripeCustomerId: null
            }
          });
        }

        // 2. Main Upsert
        const user = await tx.user.upsert({
          where: { id },
          update: {
            email,
            name,
            username,
            imageUrl,
            role,
            language,
            totalPaid: existingByEmail ? { increment: existingByEmail.totalPaid } : undefined,
            referralCount: existingByEmail ? { increment: existingByEmail.referralCount } : undefined,
            referralPoints: existingByEmail ? { increment: existingByEmail.referralPoints } : undefined,
          },
          create: {
            id,
            email,
            name,
            username,
            imageUrl,
            role,
            language: language || 'en',
            referralCode: Math.random().toString(36).substring(2, 10),
            referredById: referrerId,
            totalPaid: existingByEmail?.totalPaid || 0,
            referralCount: existingByEmail?.referralCount || 0,
            referralPoints: existingByEmail?.referralPoints || 0,
          }
        });

        // 3. Migrate relations if conflict existed
        if (existingByEmail) {
            await tx.creator.updateMany({ where: { userId: existingByEmail.id }, data: { userId: id } });
            await tx.comment.updateMany({ where: { authorId: existingByEmail.id }, data: { authorId: id } });
            await tx.subscription.updateMany({ where: { userId: existingByEmail.id }, data: { userId: id } });
            await tx.transaction.updateMany({ where: { userId: existingByEmail.id }, data: { userId: id } });
            await tx.videoLike.updateMany({ where: { userId: existingByEmail.id }, data: { userId: id } });
            await tx.videoDislike.updateMany({ where: { userId: existingByEmail.id }, data: { userId: id } });
            await tx.commentLike.updateMany({ where: { userId: existingByEmail.id }, data: { userId: id } });
            await tx.commentDislike.updateMany({ where: { userId: existingByEmail.id }, data: { userId: id } });
            await tx.user.updateMany({ where: { referredById: existingByEmail.id }, data: { referredById: id } });

            // Delete old record after re-linking everything
            await tx.user.delete({ where: { id: existingByEmail.id } });
        }

        // 4. Admin specific profile sync
        if (role === 'ADMIN') {
            await tx.creator.updateMany({
                where: { slug: 'polutek' },
                data: { name: 'POLUTEK.PL', userId: id }
            });
        }

        // 5. Handle referral counter for NEW registrations
        if (!existingByEmail && referrerId) {
            try {
                await tx.user.update({
                    where: { id: referrerId },
                    data: { referralCount: { increment: 1 } }
                });
            } catch (re: any) {
              console.warn("[UserService] Failed to increment referral counter", re.message);
            }
        }

        return user;
      }, { timeout: 15000 }); // Extended timeout for migrations
    } catch (err: any) {
       console.error("[UserService.syncUser] Error:", err.message);
       throw err;
    }
  }

  static async toggleSubscription(userId: string, creatorId: string) {
    try {
      await this.getOrCreateUser(userId);

      return await prisma.$transaction(async (tx) => {
        const existing = await tx.subscription.findUnique({
          where: { userId_creatorId: { userId, creatorId } }
        });

        if (existing) {
          await tx.subscription.delete({ where: { id: existing.id } });
          await tx.creator.update({ where: { id: creatorId }, data: { subscribersCount: { decrement: 1 } } });
          return { isSubscribed: false };
        } else {
          await tx.subscription.create({ data: { userId, creatorId } });
          await tx.creator.update({ where: { id: creatorId }, data: { subscribersCount: { increment: 1 } } });
          return { isSubscribed: true };
        }
      });
    } catch (e: any) {
      console.error("[TOGGLE_SUBSCRIPTION_ERROR]", e);
      throw e;
    }
  }

  static async softDeleteUser(id: string) {
    const anonymousId = crypto.randomUUID();
    return await prisma.user.update({
      where: { id },
      data: {
        email: `deleted_${anonymousId}@deleted.com`,
        name: "Usunięty Użytkownik",
        imageUrl: null,
        stripeCustomerId: null,
        isDeleted: true
      }
    });
  }

  static async isSubscribed(userId: string, creatorId: string) {
    const sub = await prisma.subscription.findUnique({
      where: { userId_creatorId: { userId, creatorId } }
    });
    return !!sub;
  }

  static async getVideoInteraction(userId: string, videoId: string) {
    const [like, dislike] = await Promise.all([
        prisma.videoLike.findUnique({ where: { userId_videoId: { userId, videoId } } }).catch(() => null),
        prisma.videoDislike.findUnique({ where: { userId_videoId: { userId, videoId } } }).catch(() => null)
    ]);
    return { liked: !!like, disliked: !!dislike };
  }

  static async ensureAdminUser() {
    return await prisma.user.upsert({
        where: { email: UserService.ADMIN_EMAIL },
        update: { role: 'ADMIN', name: "POLUTEK.PL" },
        create: {
            id: `admin_${Date.now()}`,
            email: UserService.ADMIN_EMAIL,
            name: "POLUTEK.PL",
            role: 'ADMIN',
            language: "pl",
            referralCode: 'admin'
        }
    });
  }
}
