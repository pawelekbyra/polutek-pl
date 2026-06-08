import { AppContext } from "@/lib/modules/shared/app-context";
import { UserRepository } from "../infrastructure/user.repository";
import { logger } from "@/lib/logger";
import crypto from "crypto";
import { isGeneratedClerkUsername } from "@/lib/utils/auth";

export interface IdentityProvider {
    getUserSyncData(userId: string): Promise<{
        email: string | null;
        name: string | null;
        username: string | null;
        imageUrl: string | null;
    }>;
    updateUserMetadata(userId: string, metadata: Record<string, any>): Promise<void>;
}

export interface UpdateUserLanguageInput {
  userId: string;
  language: "en" | "pl";
}

export async function updateUserLanguage(
  ctx: AppContext,
  input: UpdateUserLanguageInput,
  identityProvider: IdentityProvider
) {
  const repository = new UserRepository(ctx.prisma);
  const { userId, language } = input;

  const existingUser = await repository.findById(userId);

  if (existingUser?.isDeleted) {
    throw new Error("Cannot update language for deleted user");
  }

  let email = existingUser?.email ?? null;
  let name: string | null = null;
  let username: string | null = null;
  let imageUrl: string | null = null;

  if (!email) {
    const syncData = await identityProvider.getUserSyncData(userId);
    email = syncData.email;

    if (!email) throw new Error("USER_HAS_NO_EMAIL");

    username = syncData.username;
    const displayUsername = isGeneratedClerkUsername(username)
      ? null
      : username;

    name = syncData.name || displayUsername || email.split("@")[0];
    imageUrl = syncData.imageUrl;
  }

  const user = await repository.upsertUser({
    id: userId,
    email,
    name,
    username,
    imageUrl,
    language,
    referralCode: existingUser?.referralCode || crypto.randomBytes(6).toString("hex"),
  });

  // Sync to Identity Provider
  try {
    await identityProvider.updateUserMetadata(userId, {
      language: language,
    });
  } catch (clerkError) {
    logger.error(
      "[updateUserLanguage] Identity provider sync failed for user " + userId,
      clerkError
    );
  }

  return user;
}
