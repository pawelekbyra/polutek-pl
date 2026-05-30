'use server';

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function getUserTips() {
  const { userId } = await auth();
  if (!userId) return [];

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true }
  });

  if (!user) return [];

  // This part needs updating since Tip model is gone?
  // Actually, we don't have a Tip model anymore.
  // Let's check schema.prisma again.
  return [];
}
