import { logger } from "@/lib/logger";
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { clerkClient, currentUser } from '@clerk/nextjs/server';
import crypto from 'crypto';
import { ADMIN_EMAIL } from '../constants';
import { ClerkPublicMetadata, ClerkUnsafeMetadata } from '@/app/types/clerk';
import { isGeneratedClerkUsername } from '@/lib/utils/auth';
import { isConfiguredAdminUserId } from '../admin-config';
import { MAIN_CREATOR_NAME } from '../constants';

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

function isPrismaErrorCode(error: unknown, code: string) {
  return error instanceof Prisma.PrismaClientKnownRequestError || (
    typeof error === 'object' && error !== null && 'code' in error
  )
    ? (error as { code?: unknown }).code === code
    : false;
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
      logger.error("[UserService.getOrCreateUser]", message);
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
        const existingUser = await tx.user.findUnique({
          where: { id },
          select: { role: true }
        });

        // Runtime admin access is based on immutable Clerk ID allowlist or an existing DB role.
        // ADMIN_EMAIL and Clerk metadata are bootstrap/recovery inputs only and must not grant admin here.
        let targetRole: 'ADMIN' | 'USER' = 'USER';

        if (isConfiguredAdminUserId(id)) {
          targetRole = 'ADMIN';
        } else if (existingUser) {
          targetRole = existingUser.role;
        }

        const updateData: Prisma.UserUpdateInput = {
          email,
          language,
          role: targetRole,
        };

        if (referrerId && !existingUser) {
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
        const userCreatedByParallelRequest = await prisma.user.findUnique({ where: { id } })
          ?? await prisma.user.findUnique({ where: { email } });

        if (userCreatedByParallelRequest) {
          return userCreatedByParallelRequest;
        }
      }

      const message = err instanceof Error ? err.message : String(err);
      logger.error("[UserService.syncUser] Error:", message);
      throw err;
    }
  }

  static async updateUserLanguage(userId: string, language: 'en' | 'pl') {
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true }
    });

    let email = existingUser?.email ?? null;
    let name: string | null = null;
    let username: string | null = null;
    let imageUrl: string | null = null;

    if (!email) {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(userId);
      email = clerkUser.primaryEmailAddress?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress || null;

      if (!email) throw new Error("USER_HAS_NO_EMAIL");

      username = clerkUser.username || null;
      const displayUsername = isGeneratedClerkUsername(username) ? null : username;
      const fullName = (clerkUser.fullName && !isGeneratedClerkUsername(clerkUser.fullName)) ? clerkUser.fullName : null;
      const firstLast = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim();
      name = fullName || (firstLast && !isGeneratedClerkUsername(firstLast) ? firstLast : null) || displayUsername || emailLocalPart(email);
      imageUrl = clerkUser.imageUrl || null;
    }

    try {
      return await prisma.user.upsert({
        where: { id: userId },
        update: { language },
        create: {
          id: userId,
          email,
          name,
          username,
          imageUrl,
          language,
          referralCode: crypto.randomBytes(6).toString('hex'),
        }
      });
    } catch (err: unknown) {
      if (isPrismaErrorCode(err, 'P2002')) {
        const userCreatedByParallelRequest = await prisma.user.findUnique({ where: { id: userId } })
          ?? await prisma.user.findUnique({ where: { email } });

        if (userCreatedByParallelRequest) {
          return prisma.user.update({
            where: { id: userCreatedByParallelRequest.id },
            data: { language }
          });
        }
      }

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
      logger.warn(
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

  /**
   * Helper for seeder and local development only.
   * NOT FOR PRODUCTION USE.
   */
  static async ensureAdminUser() {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ensureAdminUser must not be used in production");
    }

    return await prisma.user.upsert({
        where: { email: UserService.ADMIN_EMAIL },
        update: { role: 'ADMIN', name: MAIN_CREATOR_NAME },
        create: {
            id: `admin_dev_${crypto.randomBytes(4).toString('hex')}`,
            email: UserService.ADMIN_EMAIL,
            name: MAIN_CREATOR_NAME,
            role: 'ADMIN',
            language: "pl",
            referralCode: `admin-dev-${crypto.randomBytes(4).toString('hex')}`
        }
    });
  }
}
