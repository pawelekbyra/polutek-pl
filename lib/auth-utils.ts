import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { requireAdminActor } from "@/lib/api/auth";

export class AuthError extends Error {
  constructor(
    public readonly code: "UNAUTHORIZED" | "FORBIDDEN",
    message: string = code,
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
          {
            error: error.code === "UNAUTHORIZED" ? "Unauthorized" : "Forbidden",
          },
          { status: error.code === "UNAUTHORIZED" ? 401 : 403 },
        ),
      };
    }

    logger.error(`[${scope}] Unexpected admin auth error:`, error);
    return {
      adminUserId: null,
      response: NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      ),
    };
  }
}

export async function requireUser() {
  throw new AuthError(
    "UNAUTHORIZED",
    "requireUser is not valid for privileged admin authorization",
  );
}

export async function requireAdmin() {
  try {
    const actor = await requireAdminActor();
    return actor.userId;
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === "UNAUTHORIZED" || error.statusCode === 401) {
        throw new AuthError("UNAUTHORIZED", error.message);
      }
      if (error.code === "FORBIDDEN" || error.statusCode === 403) {
        throw new AuthError("FORBIDDEN", error.message);
      }
    }
    throw error;
  }
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
