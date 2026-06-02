import { prisma } from '@/lib/prisma';
import { clerkClient, currentUser } from '@clerk/nextjs/server';
import crypto from 'crypto';
import { ADMIN_EMAIL } from '../constants';
import { ClerkPublicMetadata, ClerkUnsafeMetadata } from '@/app/types/clerk';

type AuthSessionClaims = Record<string, unknown> | null | undefined;

function stringClaim(claims: AuthSessionClaims, ...keys: string[]) {
  for (const key of keys) {
    const value = claims?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function emailLocalPart(email: string | null) {
  const localPart = email?.split('@')[0]?.trim();
  return localPart || null;
}

function isGeneratedClerkUsername(value?: string | null) {
  return /^user_[a-z0-9]+$/i.test(value?.trim() || '');
}

function hasIdentityClaim(claims: AuthSessionClaims) {
  return Boolean(
    stringClaim(
      claims,
      'email',
      'primary_email_address',
      'email_address',
      'name',
      'full_name',
      'first_name',
      'given_name',
      'last_name',
      'family_name',
      'username',
      'preferred_username',
      'picture',
      'image_url',
      'imageUrl',
      'avatar_url',
      'avatarUrl'
    )
  );
}

function metadataClaim(claims: AuthSessionClaims, metadataKey: 'publicMetadata' | 'unsafeMetadata', key: string) {
  const metadata = claims?.[metadataKey];
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const value = (metadata as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}


export class UserService {
  static readonly ADMIN_EMAIL = ADMIN_EMAIL;

  /**
   * Primary entry point for ensuring a user exists and is up to date.
   * Handles Clerk integration, ID mapping, and local DB sync.
   */
  static async getOrCreateUser(clerkUserId: string) {
    try {
      let clerkUser = await currentUser();

      if (!clerkUser || clerkUser.id !== clerkUserId) {
        try {
          clerkUser = await clerkClient.users.getUser(clerkUserId);
        } catch (apiError) {
          const local = await prisma.user.findUnique({ where: { id: clerkUserId } });
          if (local) return local;
          if (!clerkUser) throw apiError instanceof Error ? apiError : new Error("CLERK_USER_NOT_FOUND");
        }
      }

      const email = clerkUser.primaryEmailAddress?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress;
      if (!email) throw new Error("USER_HAS_NO_EMAIL");

      const username = clerkUser.username || null;
      const displayUsername = isGeneratedClerkUsername(username) ? null : username;
      const name = clerkUser.fullName || `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || displayUsername || emailLocalPart(email);
      const imageUrl = clerkUser.imageUrl || null;

      // Metadata extraction
      const publicMeta = clerkUser.publicMetadata as ClerkPublicMetadata;
      const unsafeMeta = clerkUser.unsafeMetadata as ClerkUnsafeMetadata;
      const language = publicMeta.language || publicMeta.preferredLanguage || unsafeMeta.language || unsafeMeta.preferredLanguage || 'en';
      const referrerId = unsafeMeta.referrerId || null;
      const clerkRole = publicMeta.role;

      return await this.syncUser(clerkUserId, email, name, imageUrl, referrerId, language, username, clerkRole);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[UserService.getOrCreateUser]", message);
      throw e;
    }
  }

  /**
   * Atomic synchronization logic.
   */
  static async syncUser(
    id: string,
    email: string,
    name?: string | null,
    imageUrl?: string | null,
    referrerId?: string | null,
    language?: string,
    username?: string | null,
    clerkRole?: string | null
  ) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existingUser = await tx.user.findUnique({
          where: { id },
          select: { role: true }
        });

        // Role determination:
        // 1. If Clerk metadata says ADMIN or email matches ADMIN_EMAIL, trust it.
        // 2. Otherwise keep existing role or default to USER.
        let targetRole: 'ADMIN' | 'USER' = 'USER';

        if (clerkRole === 'ADMIN' || email.toLowerCase() === UserService.ADMIN_EMAIL.toLowerCase()) {
          targetRole = 'ADMIN';
        } else if (existingUser) {
          targetRole = existingUser.role;
        }

        const user = await tx.user.upsert({
          where: { id },
          update: {
            email,
            name,
            username,
            imageUrl,
            language,
            role: targetRole,
          },
          create: {
            id,
            email,
            name,
            username,
            imageUrl,
            role: targetRole,
            language: language || 'en',
            referralCode: crypto.randomBytes(6).toString('hex'),
          }
        });

        if (targetRole === 'ADMIN') {
            await tx.creator.updateMany({
                where: { slug: 'polutek' },
                data: { name: 'Paweł Perfect', userId: id }
            });
        }

        return user;
      }, { timeout: 15000 });
    } catch (err: unknown) {
       const message = err instanceof Error ? err.message : String(err);
       console.error("[UserService.syncUser] Error:", message);
       throw err;
    }
  }


  /**
   * Ensures comment authors have a local row even when Clerk's user API is
   * temporarily unavailable in a route handler. Comments require a User FK, so
   * an authenticated Clerk session must be enough to create a minimal profile.
   */
  static async getOrCreateUserFromAuth(userId: string, sessionClaims?: AuthSessionClaims) {
    try {
      const user = await this.getOrCreateUser(userId);

      // If Clerk's backend API was temporarily unavailable, getOrCreateUser may
      // return an already-existing local row. Refresh local display fields from
      // session claims so freshly posted comments don't show placeholder author
      // names or avatars.
      if (hasIdentityClaim(sessionClaims)) {
        const syncedFromClaims = await this.syncUserFromClaims(userId, sessionClaims, user);
        if (syncedFromClaims) return syncedFromClaims;
      }

      return user;
    } catch (error) {
      console.warn(
        "[UserService.getOrCreateUserFromAuth] Falling back to session claims:",
        error instanceof Error ? error.message : String(error)
      );
    }

    const existing = await prisma.user.findUnique({ where: { id: userId } });
    const syncedFromClaims = await this.syncUserFromClaims(userId, sessionClaims, existing);
    if (syncedFromClaims) return syncedFromClaims;

    return this.syncUserFromClaims(userId, sessionClaims, existing, true);
  }

  private static async syncUserFromClaims(
    userId: string,
    sessionClaims: AuthSessionClaims,
    existing?: {
      email?: string | null;
      username?: string | null;
      name?: string | null;
      imageUrl?: string | null;
    } | null,
    allowPlaceholderEmail = false
  ) {
    if (!allowPlaceholderEmail && !hasIdentityClaim(sessionClaims)) return null;

    const email = stringClaim(sessionClaims, 'email', 'primary_email_address', 'email_address')
      || existing?.email
      || `${userId}@clerk.local`;
    const firstName = stringClaim(sessionClaims, 'first_name', 'given_name', 'firstName');
    const lastName = stringClaim(sessionClaims, 'last_name', 'family_name', 'lastName');
    const username = stringClaim(sessionClaims, 'username', 'preferred_username')
      || metadataClaim(sessionClaims, 'publicMetadata', 'username')
      || metadataClaim(sessionClaims, 'unsafeMetadata', 'username')
      || existing?.username
      || null;
    const displayUsername = isGeneratedClerkUsername(username) ? null : username;
    const isPlaceholderEmail = email.endsWith('@clerk.local');
    const rawClaimName = stringClaim(sessionClaims, 'name', 'full_name');
    const claimName = isGeneratedClerkUsername(rawClaimName) ? null : rawClaimName;
    const existingName = isGeneratedClerkUsername(existing?.name) ? null : existing?.name;
    const name = claimName
      || [firstName, lastName].filter(Boolean).join(' ')
      || displayUsername
      || existingName
      || (isPlaceholderEmail ? null : emailLocalPart(email));
    const imageUrl = stringClaim(sessionClaims, 'picture', 'image_url', 'imageUrl', 'avatar_url', 'avatarUrl')
      || existing?.imageUrl
      || null;
    const language = metadataClaim(sessionClaims, 'publicMetadata', 'language')
      || metadataClaim(sessionClaims, 'unsafeMetadata', 'language')
      || stringClaim(sessionClaims, 'locale')
      || 'en';
    const referrerId = metadataClaim(sessionClaims, 'unsafeMetadata', 'referrerId');
    const clerkRole = metadataClaim(sessionClaims, 'publicMetadata', 'role');

    return this.syncUser(userId, email, name, imageUrl, referrerId, language, username, clerkRole);
  }

  static async toggleSubscription(userId: string, creatorId: string) {
    try {
      await this.getOrCreateUser(userId);

      return await prisma.$transaction(async (tx) => {
        const creator = await tx.creator.findUnique({
          where: { id: creatorId },
          select: { id: true, isApproved: true },
        });

        if (!creator || !creator.isApproved) {
          throw new Error('CREATOR_NOT_FOUND');
        }

        const existing = await tx.subscription.findUnique({
          where: { userId_creatorId: { userId, creatorId } }
        });

        if (existing) {
          await tx.subscription.delete({ where: { id: existing.id } });
          await tx.creator.updateMany({ where: { id: creatorId, subscribersCount: { gt: 0 } }, data: { subscribersCount: { decrement: 1 } } });
          return { isSubscribed: false };
        } else {
          await tx.subscription.create({ data: { userId, creatorId } });
          await tx.creator.update({ where: { id: creatorId }, data: { subscribersCount: { increment: 1 } } });
          return { isSubscribed: true };
        }
      });
    } catch (e: unknown) {
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
        update: { role: 'ADMIN', name: "Paweł Perfect" },
        create: {
            id: `admin_${Date.now()}`,
            email: UserService.ADMIN_EMAIL,
            name: "Paweł Perfect",
            role: 'ADMIN',
            language: "pl",
            referralCode: 'admin'
        }
    });
  }
}
