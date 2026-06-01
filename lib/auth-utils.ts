import { auth } from "@clerk/nextjs/server";
import { prisma } from "./prisma";
import { UserService } from "./services/user.service";

export class AuthError extends Error {
  constructor(
    public readonly code: "UNAUTHORIZED" | "FORBIDDEN",
    message = code
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireUser() {
  const { userId } = await auth();
  if (!userId) throw new AuthError("UNAUTHORIZED");

  await UserService.getOrCreateUser(userId);
  return userId;
}

export async function requireAdmin() {
  const userId = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isDeleted: true },
  });

  if (!user || user.isDeleted || user.role !== "ADMIN") {
    throw new AuthError("FORBIDDEN");
  }

  return userId;
}

export async function isAdmin(): Promise<boolean> {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}

