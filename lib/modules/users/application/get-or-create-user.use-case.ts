import { AppContext } from "@/lib/modules/shared/app-context";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { SyncUserUseCase } from "./sync-user.use-case";
import { isGeneratedClerkUsername } from "@/lib/utils/auth";
import { ClerkPublicMetadata, ClerkUnsafeMetadata } from "@/app/types/clerk";

function emailLocalPart(email: string | null) {
  const localPart = email?.split('@')[0]?.trim();
  return localPart || null;
}

export class GetOrCreateUserUseCase {
  /**
   * Main entry point for ensuring a user exists and is synced from Clerk.
   * This is a modular replacement for legacy UserProfileService.getOrCreateUser.
   */
  static async execute(ctx: AppContext, clerkUserId: string | { id: string; email: string; name?: string | null; username?: string | null; imageUrl?: string | null; language?: string; }) {
    if (typeof clerkUserId !== 'string') {
      return await SyncUserUseCase.execute(ctx, clerkUserId);
    }

    let clerkUser = await currentUser();

    if (!clerkUser || clerkUser.id !== clerkUserId) {
        try {
          const client = await clerkClient();
          clerkUser = await client.users.getUser(clerkUserId);
        } catch (apiError) {
          // If Clerk is down, we try to return local user from DB
          const local = await ctx.prisma.user.findUnique({ where: { id: clerkUserId } });
          if (local) return local;
          throw apiError;
        }
    }

    if (!clerkUser) throw new Error("CLERK_USER_NOT_FOUND");

    const email = clerkUser.primaryEmailAddress?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) throw new Error("USER_HAS_NO_EMAIL");

    const username = clerkUser.username || null;
    const displayUsername = isGeneratedClerkUsername(username) ? null : username;
    const fullName = (clerkUser.fullName && !isGeneratedClerkUsername(clerkUser.fullName)) ? clerkUser.fullName : null;
    const firstLast = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim();
    const name = fullName || (firstLast && !isGeneratedClerkUsername(firstLast) ? firstLast : null) || displayUsername || emailLocalPart(email);
    const imageUrl = clerkUser.imageUrl || null;

    const publicMeta = clerkUser.publicMetadata as ClerkPublicMetadata;
    const unsafeMeta = clerkUser.unsafeMetadata as ClerkUnsafeMetadata;
    const language = publicMeta.language || publicMeta.preferredLanguage || unsafeMeta.language || unsafeMeta.preferredLanguage || 'pl';
    const referrerId = unsafeMeta.referrerId || null;

    return await SyncUserUseCase.execute(ctx, {
        id: clerkUserId,
        email,
        name,
        username,
        imageUrl,
        language,
        referrerId
    });
  }
}
