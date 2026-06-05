'use server';

import { logger } from "@/lib/logger";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { UserService } from "@/lib/services/user.service";

export async function updateUserLanguage(language: 'en' | 'pl') {
  const { userId } = await auth();
  if (!userId) return { error: "AUTH_REQUIRED" };

  try {
    // Centralized update for both DB and Clerk Metadata
    await UserService.updateUserLanguage(userId, language);
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error: unknown) {
    logger.error("[UPDATE_USER_LANGUAGE_ERROR]", error);
    return { error: "INTERNAL_ERROR", message: error instanceof Error ? error.message : String(error) };
  }
}
