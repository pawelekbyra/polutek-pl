import { auth } from "@clerk/nextjs/server";
import { AppError } from "@/lib/errors";
import { Actor } from "@/lib/modules/shared/actor";
import { prisma } from "@/lib/prisma";
import { isConfiguredAdminUserId } from "@/lib/admin-config";
import { getPatronStatus } from "@/lib/modules/patron";
import { createAppContext } from "@/lib/modules/shared/app-context";

function metadataValue(claims: unknown, key: string): unknown {
  if (!claims || typeof claims !== "object") return undefined;
  const metadata = (claims as { metadata?: Record<string, unknown> }).metadata;
  return metadata?.[key];
}

export async function getAuthSession() {
  const { userId, sessionClaims } = await auth();
  const role = metadataValue(sessionClaims, "role");
  const isPatron = metadataValue(sessionClaims, "isPatron");
  return {
    userId,
    /** Non-authoritative UI hint only. Never use for server authorization. */
    role: typeof role === "string" ? role : undefined,
    /** Non-authoritative UI hint only. Never use for access-control decisions. */
    isPatron: typeof isPatron === "boolean" ? isPatron : undefined,
  };
}

type ActorResolverOptions = {
  allowGuest?: boolean;
};

async function resolveDbBackedActor(userId: string): Promise<Actor> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isDeleted: true },
  });

  if (!user || user.isDeleted) {
    throw new AppError("Forbidden", 403, "FORBIDDEN");
  }

  if (user.role === "ADMIN" || isConfiguredAdminUserId(userId)) {
    return { type: "admin", userId };
  }

  const ctx = createAppContext({
    actor: { type: "user", userId, isPatron: false },
  });
  const patronStatus = await getPatronStatus(userId, ctx);

  return {
    type: "user",
    userId,
    isPatron: patronStatus.ok
      ? patronStatus.data.activeGrants.length > 0
      : false,
  };
}

export async function requireAdminSession() {
  const actor = await getActorFromAuth({ allowGuest: false });
  if (actor.type !== "admin") {
    throw new AppError("Forbidden: Admin access required", 403, "FORBIDDEN");
  }
  return { userId: actor.userId, role: "admin" as const, isPatron: undefined };
}

/**
 * Builds a server-side Actor from Clerk identity plus current local DB truth.
 *
 * Clerk confirms identity. The local DB confirms role/account status. Session
 * claims and publicMetadata are never authoritative for server authorization.
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

export async function requireActorFromAuth(): Promise<
  Exclude<Actor, { type: "guest" }>
> {
  return getActorFromAuth({ allowGuest: false }) as Promise<
    Exclude<Actor, { type: "guest" }>
  >;
}
