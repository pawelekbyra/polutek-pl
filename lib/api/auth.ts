import { auth } from "@/lib/auth/server";
import { AppError } from "@/lib/errors";
import { Actor } from "@/lib/modules/shared/actor";
import { prisma } from "@/lib/prisma";


/**
 * Admin = `User.role === ADMIN` in our database, nothing else. On the public site the role is only a
 * flag (draft previews, the owner's menu link to the panel); the panel at admin.pawelperfect.com has its
 * own accounts and sign-in. There is no e-mail bootstrap any more (ADMIN_EMAILS was removed in phase 5,
 * docs/architecture/admin-phase5.md): the role is changed with changeUserRoleAsAdmin or the ops script.
 */
function isAdminUser(user: { role: string }): boolean {
  return user.role === "ADMIN";
}

type ActorResolverOptions = {
  allowGuest?: boolean;
};

export async function resolveDbBackedActor(userId: string): Promise<Actor> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isDeleted: true, onboardingPending: true },
  });

  if (!user || user.isDeleted) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }

  if (isAdminUser(user)) {
    return { type: "admin", userId };
  }

  // Server-side half of the first-sign-in dialog (audit AUTH-11): see Actor.onboardingPending.
  return user.onboardingPending ? { type: "user", userId, onboardingPending: true } : { type: "user", userId };
}

async function resolveDbBackedAdminActor(
  userId: string,
): Promise<{ type: "admin"; userId: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isDeleted: true },
  });

  if (!user || user.isDeleted) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }

  if (isAdminUser(user)) {
    return { type: "admin", userId };
  }

  throw new AppError("Forbidden: Admin access required", 403, "FORBIDDEN");
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
