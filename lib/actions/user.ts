'use server';

import { logger } from "@/lib/logger";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { updateUserLanguage as updateUserLanguageUseCase } from "@/lib/modules/users";
import { ClerkIdentityProvider } from "@/lib/api/identity-provider";

export async function updateUserLanguage(language: 'en' | 'pl') {
  const { userId } = await auth();
  if (!userId) return { error: "AUTH_REQUIRED" };

  try {
    // Same use case as PATCH /api/user/language so both entry points share one
    // set of rules (deleted-user rejection, domain errors, Clerk metadata sync).
    const ctx = createAppContext({ actor: { type: "user", userId } });
    await updateUserLanguageUseCase(
      ctx,
      { userId, language },
      new ClerkIdentityProvider(),
    );
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error: unknown) {
    logger.error("[UPDATE_USER_LANGUAGE_ERROR]", error);
    return { error: "INTERNAL_ERROR", message: error instanceof Error ? error.message : String(error) };
  }
}
