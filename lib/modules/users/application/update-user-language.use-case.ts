import { AppContext } from "@/lib/modules/shared/app-context";
import { UserRepository } from "../infrastructure/user.repository";
import { logger } from "@/lib/logger";
import { isGeneratedClerkUsername } from "@/lib/utils/auth";
import { UserDeletedError, UserHasNoEmailError } from "../domain/user.errors";

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
    throw new UserDeletedError(userId);
  }

  let email = existingUser?.email ?? null;
  // Left undefined (not null) when the local row already exists: these are only
  // resolved from the identity provider for a first-time row, and passing an
  // explicit null would blank the stored profile on every language change.
  let name: string | undefined;
  let username: string | undefined;
  let imageUrl: string | undefined;

  if (!email) {
    const syncData = await identityProvider.getUserSyncData(userId);
    email = syncData.email;

    if (!email) throw new UserHasNoEmailError(userId);

    username = syncData.username ?? undefined;
    const displayUsername = isGeneratedClerkUsername(username)
      ? null
      : username;

    name = syncData.name || displayUsername || email.split("@")[0];
    imageUrl = syncData.imageUrl ?? undefined;
  }

  const user = await repository.upsertUser({
    id: userId,
    email,
    name,
    username,
    imageUrl,
    language,
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
