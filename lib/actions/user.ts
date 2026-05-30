'use server';

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function updateUserLanguage(language: 'en' | 'pl') {
  const { userId } = await auth();
  if (!userId) return { error: "AUTH_REQUIRED" };

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { language: language }
    });
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (error: any) {
    console.error("[UPDATE_USER_LANGUAGE_ERROR]", error);
    return { error: "INTERNAL_ERROR", message: error.message };
  }
}
