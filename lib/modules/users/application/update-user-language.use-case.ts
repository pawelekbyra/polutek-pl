import type { Locale } from "@/lib/i18n/routing";
import { AppContext } from "@/lib/modules/shared/app-context";
import { UserRepository } from "../infrastructure/user.repository";
import { UserDeletedError, UserNotFoundError } from "../domain/user.errors";

export interface UpdateUserLanguageInput {
  userId: string;
  language: Locale;
}

/** Stores the signed-in user's UI/e-mail language (the database is the only copy). */
export async function updateUserLanguage(ctx: AppContext, input: UpdateUserLanguageInput) {
  const repository = new UserRepository(ctx.prisma);
  const existingUser = await repository.findById(input.userId);

  if (!existingUser) throw new UserNotFoundError(input.userId);
  if (existingUser.isDeleted) throw new UserDeletedError(input.userId);

  return repository.upsertUser({
    id: input.userId,
    email: existingUser.email,
    language: input.language,
  });
}
