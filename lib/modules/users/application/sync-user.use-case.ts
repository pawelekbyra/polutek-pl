import { logger } from "@/lib/logger";
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { clerkClient, currentUser as getCurrentClerkUser } from '@clerk/nextjs/server';
import { ClerkPublicMetadata, ClerkUnsafeMetadata } from '@/app/types/clerk';
import { isGeneratedClerkUsername } from '@/lib/utils/auth';
import { UserAdminService } from '../infrastructure/user-admin.service';
import { isPrismaErrorCode } from '@/lib/utils/db';
import { normalizePaymentTotals } from "@/lib/modules/users";

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

/**
 * Atomic synchronization logic migrated from UserProfileService.
 */
export async function syncUser(
  id: string,
  email: string,
  name?: string | null,
  imageUrl?: string | null,
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
        select: { id: true, role: true, email: true, isDeleted: true }
      });

      const isEmailConflict = existingUserByEmail && existingUserByEmail.id !== id;
      const isDeletedEmailTombstone = Boolean(isEmailConflict && existingUserByEmail?.isDeleted);

      // 1. If email is taken by a DIFFERENT user ID, we have a conflict.
      // Free the email from the old record.
      if (isEmailConflict) {
        logger.warn(`[SyncUser] Email conflict: ${email} is owned by ${existingUserByEmail.id}. Attempting to resolve.`);
        await tx.user.update({
          where: { id: existingUserByEmail.id },
          data: { email: `${existingUserByEmail.email}_stale_${Date.now()}` }
        });
      }

      // 2. Upsert the target user record BEFORE repointing related records to ensure ID exists
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
        }
      });

      // 3. If there was a non-deleted conflict, repoint historical records but never transfer mailing consent
      if (isEmailConflict && !isDeletedEmailTombstone) {
        const oldId = existingUserByEmail.id;

        // Comments
        const movedComments = await tx.comment.updateMany({
          where: { authorId: oldId },
          data: { authorId: id }
        });

        // Comment Reactions - avoid unique constraint violations
        const oldReactions = await tx.commentReaction.findMany({ where: { userId: oldId } });
        for (const reaction of oldReactions) {
            await tx.commentReaction.upsert({
                where: { userId_commentId: { userId: id, commentId: reaction.commentId } },
                update: {}, // Keep existing new reaction if any
                create: { userId: id, commentId: reaction.commentId, type: reaction.type, createdAt: reaction.createdAt }
            });
        }
        await tx.commentReaction.deleteMany({ where: { userId: oldId } });

        // Comment Reports - avoid unique constraint violations
        const oldReports = await tx.commentReport.findMany({ where: { reporterId: oldId } });
        for (const report of oldReports) {
            await tx.commentReport.upsert({
                where: { commentId_reporterId: { commentId: report.commentId, reporterId: id } },
                update: {},
                create: {
                    commentId: report.commentId,
                    reporterId: id,
                    reason: report.reason,
                    note: report.note,
                    status: report.status,
                    createdAt: report.createdAt
                }
            });
        }
        await tx.commentReport.deleteMany({ where: { reporterId: oldId } });

        // Legacy Comment Likes/Dislikes
        await tx.commentLike.deleteMany({
            where: { userId: id, commentId: { in: (await tx.commentLike.findMany({ where: { userId: oldId }, select: { commentId: true } })).map(l => l.commentId) } }
        });
        await tx.commentLike.updateMany({ where: { userId: oldId }, data: { userId: id } });

        await tx.commentDislike.deleteMany({
            where: { userId: id, commentId: { in: (await tx.commentDislike.findMany({ where: { userId: oldId }, select: { commentId: true } })).map(d => d.commentId) } }
        });
        await tx.commentDislike.updateMany({ where: { userId: oldId }, data: { userId: id } });

        // Audit Logs
        await tx.auditLog.updateMany({ where: { actorUserId: oldId }, data: { actorUserId: id } });

        // Issue 12: Merge Financial and Access Records
        // Payments
        await tx.payment.updateMany({ where: { userId: oldId }, data: { userId: id } });

        // UserPaymentTotals (Merge counts)
        const oldTotals = await tx.userPaymentTotal.findMany({ where: { userId: oldId } });
        for (const total of oldTotals) {
            await tx.userPaymentTotal.upsert({
                where: { userId_currency: { userId: id, currency: total.currency } },
                update: {
                    amountMinor: { increment: total.amountMinor },
                },
                create: {
                    userId: id,
                    currency: total.currency,
                    amountMinor: total.amountMinor,
                }
            });
        }
        await tx.userPaymentTotal.deleteMany({ where: { userId: oldId } });

        // PatronGrants
        await tx.patronGrant.updateMany({ where: { userId: oldId }, data: { userId: id } });

        // Patron status is derived from PatronGrant records — no User fields to update.

        // Subscription is explicit mailing consent only. Identity sync must never
        // transfer newsletter consent from an old/stale identity to a new Clerk id.
        const oldSubs = await tx.subscription.findMany({ where: { userId: oldId }, select: { creatorId: true } });
        await tx.subscription.deleteMany({ where: { userId: oldId } });
        for (const sub of oldSubs) {
          const activeCount = await tx.subscription.count({ where: { creatorId: sub.creatorId } });
          await tx.creator.updateMany({ where: { id: sub.creatorId }, data: { subscribersCount: activeCount } });
        }
        await tx.emailPreference.deleteMany({ where: { userId: oldId } });

        logger.info(`[SyncUser] Merged records from ${oldId} to ${id}`, {
            movedComments: movedComments.count,
            email
        });
      }

      return user;
    }, { timeout: 30000 });
  } catch (err: unknown) {
    if (isPrismaErrorCode(err, 'P2002')) {
      const userCreatedByParallelRequest = await prisma.user.findUnique({ where: { id } });
      if (userCreatedByParallelRequest) return userCreatedByParallelRequest;
      const userWithEmail = await prisma.user.findUnique({ where: { email } });
      if (userWithEmail && userWithEmail.id === id) return userWithEmail;
    }

    const message = err instanceof Error ? err.message : String(err);
    logger.error("[SyncUser] Error:", message);
    throw err;
  }
}

/**
 * Primary entry point for ensuring a user exists and is up to date.
 * Handles Clerk integration, ID mapping, and local DB sync.
 */
export async function getOrCreateUser(clerkUserId: string) {
  try {
    let clerkUser = await getCurrentClerkUser();

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
    const clerkRole = publicMeta.role;

    return await syncUser(clerkUserId, email, name, imageUrl, language, username, clerkRole);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error("[getOrCreateUser]", message);
    throw e;
  }
}

/**
 * Ensures comment authors have a local row even when Clerk's user API is
 * temporarily unavailable in a route handler.
 */
export async function getOrCreateUserFromAuth(userId: string, sessionClaims?: AuthSessionClaims) {
  try {
    const user = await getOrCreateUser(userId);
    if (hasIdentityClaim(sessionClaims)) {
      const syncedFromClaims = await syncUserFromClaims(userId, sessionClaims, user);
      if (syncedFromClaims) return syncedFromClaims;
    }
    return user;
  } catch (error) {
    logger.warn(
      "[getOrCreateUserFromAuth] Falling back to session claims:",
      error instanceof Error ? error.message : String(error)
    );
  }

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  const syncedFromClaims = await syncUserFromClaims(userId, sessionClaims, existing);
  if (syncedFromClaims) return syncedFromClaims;

  return syncUserFromClaims(userId, sessionClaims, existing, true);
}

async function syncUserFromClaims(
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
  const clerkRole = metadataClaim(sessionClaims, 'publicMetadata', 'role');

  return syncUser(userId, email, name, imageUrl, language, username, clerkRole);
}
