import { prisma } from '@/lib/prisma';
import { clerkClient } from '@clerk/nextjs/server';
import { logger } from "@/lib/logger";
import { isGeneratedClerkUsername } from '@/lib/utils/auth';
import { isPrismaErrorCode } from '@/lib/utils/db';
import crypto from 'crypto';

function emailLocalPart(email: string | null) {
  const localPart = email?.split('@')[0]?.trim();
  return localPart || null;
}

export class UserLanguageService {
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
      const user = await prisma.user.upsert({
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

      // Update Clerk Metadata for persistence and webhook use
      try {
        const client = await clerkClient();
        await client.users.updateUserMetadata(userId, {
          publicMetadata: {
            language: language
          }
        });
      } catch (clerkError) {
        logger.error("[UserLanguageService.updateUserLanguage] Clerk sync failed:", clerkError);
      }

      return user;
    } catch (err: unknown) {
      // Handle P2002 race condition
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
}
