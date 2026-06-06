import { logger } from "@/lib/logger";
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { clerkClient, currentUser } from '@clerk/nextjs/server';
import crypto from 'crypto';
import { ClerkPublicMetadata, ClerkUnsafeMetadata } from '@/app/types/clerk';
import { isGeneratedClerkUsername } from '@/lib/utils/auth';
import { UserAdminService } from './admin.service';
import { isPrismaErrorCode } from '@/lib/utils/db';

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

function hasIdentityClaim(claims: AuthSessionClaims) {
  return Boolean(
    stringClaim(
      claims,
      'email',
      'primary_email_address',
      'email_address',
      'name',
      'full_name',
      'fullName',
      'first_name',
      'given_name',
      'firstName',
      'last_name',
      'family_name',
      'lastName',
      'username',
      'preferred_username',
      'picture',
      'img',
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


export class UserProfileService {
  /**
   * Primary entry point for ensuring a user exists and is up to date.
   * Handles Clerk integration, ID mapping, and local DB sync.
   */
  static async getOrCreateUser(clerkUserId: string) {
    try {
      let clerkUser = await currentUser();

      if (!clerkUser || clerkUser.id !== clerkUserId) {
        try {
          const client = await clerkClient();
          clerkUser = await client.users.getUser(clerkUserId);
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
      const fullName = (clerkUser.fullName && !isGeneratedClerkUsername(clerkUser.fullName)) ? clerkUser.fullName : null;
      const firstLast = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim();
      const name = fullName || (firstLast && !isGeneratedClerkUsername(firstLast) ? firstLast : null) || displayUsername || emailLocalPart(email);
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
      logger.error("[UserProfileService.getOrCreateUser]", message);
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
    _clerkRole?: string | null
  ) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existingUserById = await tx.user.findUnique({
          where: { id },
          select: { id: true, role: true, email: true }
        });

        const existingUserByEmail = await tx.user.findUnique({
          where: { email },
          select: { id: true, role: true, email: true }
        });

        // If email is taken by a DIFFERENT user ID, we have a conflict.
        // This often happens during migrations or if a user's Clerk ID changed.
        if (existingUserByEmail && existingUserByEmail.id !== id) {
          logger.warn(`[UserProfileService.syncUser] Email conflict: ${email} is owned by ${existingUserByEmail.id}, but Clerk says it should be ${id}. Attempting to resolve by prioritizing new Clerk ID.`);

          // To safely allow the new ID to take over this email, we must "free" the email from the old record.
          // We append a suffix to the old record's email.
          await tx.user.update({
            where: { id: existingUserByEmail.id },
            data: { email: `${existingUserByEmail.email}_stale_${Date.now()}` }
          });
        }

        // Runtime admin access is based on immutable Clerk ID allowlist or an existing DB role.
        let targetRole: 'ADMIN' | 'USER' = 'USER';

        if (UserAdminService.isConfiguredAdmin(id)) {
          targetRole = 'ADMIN';
        } else if (existingUserById) {
          targetRole = existingUserById.role;
        }

        const updateData: Prisma.UserUpdateInput = {
          email,
          language,
          role: targetRole,
        };

        if (referrerId && !existingUserById) {
            const referrer = await tx.user.findUnique({
                where: { id: referrerId },
                select: { id: true }
            });
            if (referrer && referrer.id !== id) {
                updateData.referredBy = { connect: { id: referrer.id } };
            }
        }

        if (name) updateData.name = name;
        if (username) updateData.username = username;
        if (imageUrl) updateData.imageUrl = imageUrl;

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
            language: language || 'en',
            referralCode: crypto.randomBytes(6).toString('hex'),
            referredBy: updateData.referredBy ? (updateData.referredBy as Prisma.UserCreateNestedOneWithoutReferralsInput) : undefined,
          }
        });

        return user;
      }, { timeout: 15000 });
    } catch (err: unknown) {
      if (isPrismaErrorCode(err, 'P2002')) {
        // Double-check if it's already there (parallel request)
        const userCreatedByParallelRequest = await prisma.user.findUnique({ where: { id } });
        if (userCreatedByParallelRequest) return userCreatedByParallelRequest;

        // If it's an email conflict that survived our pre-check (highly unlikely), try one more time to find it
        const userWithEmail = await prisma.user.findUnique({ where: { email } });
        if (userWithEmail && userWithEmail.id === id) return userWithEmail;
      }

      const message = err instanceof Error ? err.message : String(err);
      logger.error("[UserProfileService.syncUser] Error:", message);
      throw err;
    }
  }

  /**
   * Ensures comment authors have a local row even when Clerk's user API is
   * temporarily unavailable in a route handler.
   */
  static async getOrCreateUserFromAuth(userId: string, sessionClaims?: AuthSessionClaims) {
    try {
      const user = await this.getOrCreateUser(userId);
      if (hasIdentityClaim(sessionClaims)) {
        const syncedFromClaims = await this.syncUserFromClaims(userId, sessionClaims, user);
        if (syncedFromClaims) return syncedFromClaims;
      }
      return user;
    } catch (error) {
      logger.warn(
        "[UserProfileService.getOrCreateUserFromAuth] Falling back to session claims:",
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
    const rawClaimName = stringClaim(sessionClaims, 'name', 'full_name', 'fullName');
    const claimName = isGeneratedClerkUsername(rawClaimName) ? null : rawClaimName;
    const existingName = isGeneratedClerkUsername(existing?.name) ? null : existing?.name;
    const name = claimName
      || [firstName, lastName].filter(Boolean).join(' ')
      || displayUsername
      || existingName
      || (isPlaceholderEmail ? null : emailLocalPart(email));
    const imageUrl = stringClaim(sessionClaims, 'picture', 'img', 'image_url', 'imageUrl', 'avatar_url', 'avatarUrl')
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

  static async getVideoInteraction(userId: string, videoId: string) {
    const [like, dislike] = await Promise.all([
        prisma.videoLike.findUnique({ where: { userId_videoId: { userId, videoId } } }).catch(() => null),
        prisma.videoDislike.findUnique({ where: { userId_videoId: { userId, videoId } } }).catch(() => null)
    ]);
    return { liked: !!like, disliked: !!dislike };
  }
}
