import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "./prisma";
import { UserService } from "./services/user.service";
import { ADMIN_EMAIL } from "./constants";
import { NextResponse } from "next/server";

export class AuthError extends Error {
  constructor(
    public readonly code: "UNAUTHORIZED" | "FORBIDDEN",
    message = code
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireAdminForApi(scope: string) {
  try {
    const adminUserId = await requireAdmin();
    return { adminUserId, response: null as null };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        adminUserId: null,
        response: NextResponse.json(
          { error: error.code === "UNAUTHORIZED" ? "Unauthorized" : "Forbidden" },
          { status: error.code === "UNAUTHORIZED" ? 401 : 403 }
        ),
      };
    }

    console.error(`[${scope}] Unexpected admin auth error:`, error);
    return {
      adminUserId: null,
      response: NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      ),
    };
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
    select: { role: true, isDeleted: true, email: true },
  });

  if (!user || user.isDeleted) {
    throw new AuthError("FORBIDDEN");
  }

  // Bootstrap Admin logic
  if (user.role !== "ADMIN" && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    await prisma.user.update({
      where: { id: userId },
      data: { role: "ADMIN" }
    });
    return userId;
  }

  if (user.role !== "ADMIN") {
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

/**
 * LEGACY boolean helper. Do not use in production admin routes/pages.
 * It masks technical errors as false.
 */
export async function verifyAdmin() {
  return isAdmin();
}

export async function isAdminRequest() {
  return isAdmin();
}
