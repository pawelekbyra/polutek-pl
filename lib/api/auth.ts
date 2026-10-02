import { auth } from "@/lib/auth/server";
import { AppError } from "@/lib/errors";
import { Actor } from "@/lib/modules/shared/actor";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/auth/config";
import { recordAuthAudit } from "@/lib/auth/audit";


export async function getAuthSession() {
  const { userId } = await auth();
  return {
    userId,
    /** Non-authoritative UI hint only. Never use for server authorization. */
    role: undefined as string | undefined,
    /** Non-authoritative UI hint only. Never use for access-control decisions. */
    isPatron: undefined as boolean | undefined,
  };
}

/**
 * Admin = `User.role === ADMIN` in our database. One-time bootstrap: a verified account whose
 * e-mail is listed in ADMIN_EMAILS is promoted on first use (and the promotion is audited).
 * A never-verified address cannot be promoted, so nobody can claim an admin e-mail by signing
 * up with it first.
 */
async function isAdminUser(user: { id: string; role: string; email: string; emailVerified: boolean }): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  if (user.emailVerified && isAdminEmail(user.email)) {
    await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
    await recordAuthAudit({ action: "AUTH_ADMIN_BOOTSTRAP", userId: user.id, metadata: { source: "ADMIN_EMAILS" } });
    return true;
  }
  return false;
}

type ActorResolverOptions = {
  allowGuest?: boolean;
};

export async function resolveDbBackedActor(userId: string): Promise<Actor> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isDeleted: true, email: true, emailVerified: true },
  });

  if (!user || user.isDeleted) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }

  if (await isAdminUser(user)) {
    return { type: "admin", userId };
  }

  return {
    type: "user",
    userId,
  };
}

async function resolveDbBackedAdminActor(
  userId: string,
): Promise<{ type: "admin"; userId: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isDeleted: true, email: true, emailVerified: true },
  });

  if (!user || user.isDeleted) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }

  if (await isAdminUser(user)) {
    return { type: "admin", userId };
  }

  throw new AppError("Forbidden: Admin access required", 403, "FORBIDDEN");
}

export async function requireAdminSession() {
  const actor = await requireAdminActor();
  return { userId: actor.userId, role: "admin" as const };
}

/**
 * Builds a server-side Actor from the Better Auth session plus current local DB truth.
 *
 * The session confirms identity. The local DB confirms role/account status. Nothing in
 * the session cookie is authoritative for roles.
 * Patron state is resolved from the current DB read model without changing
 * PatronGrant semantics.
 */
export async function getActorFromAuth(
  options: ActorResolverOptions = { allowGuest: true },
): Promise<Actor> {
  const { userId } = await auth();
  if (!userId) {
    if (options.allowGuest === false) {
      throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
    }
    return { type: "guest" };
  }

  return resolveDbBackedActor(userId);
}

export async function requireAdminActor(): Promise<{
  type: "admin";
  userId: string;
}> {
  const { userId } = await auth({ fresh: true });
  if (!userId) {
    throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
  }
  return resolveDbBackedAdminActor(userId);
}

export async function requireActorFromAuth(): Promise<
  Exclude<Actor, { type: "guest" }>
> {
  return getActorFromAuth({ allowGuest: false }) as Promise<
    Exclude<Actor, { type: "guest" }>
  >;
}
