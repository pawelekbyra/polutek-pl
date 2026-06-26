import { AppContext } from "@/lib/modules/shared/app-context";
import { UserRepository } from "../infrastructure/user.repository";
import { UserPolicy } from "../domain/user.policy";
import { SystemRole } from "@prisma/client";

export interface UserAccessProfileDto {
  id: string;
  clerkId: string;
  email: string | null;
  role: SystemRole;
  /** Active PatronGrant truth. Never derived from legacy User.isPatron cache. */
  isPatron: boolean;
  isAdmin: boolean;
  isDeleted: boolean;
  language: string | null;
}

/**
 * getUserAccessProfile provides a standardized local read model for user access
 * surfaces. Admin status is derived from the local User role, while patron
 * status is derived from active PatronGrant truth instead of the legacy
 * User.isPatron cache/read model.
 */
export async function getUserAccessProfile(
  ctx: AppContext,
  userId: string
): Promise<UserAccessProfileDto | null> {
  const repository = new UserRepository(ctx.prisma);
  const user = await repository.findById(userId);

  if (!user) return null;

  const activePatronGrant = await ctx.prisma.patronGrant.findFirst({
    where: { userId: user.id, revokedAt: null },
    select: { id: true },
  });

  return {
    id: user.id,
    clerkId: user.id, // In this system, userId IS clerkId
    email: user.email,
    role: user.role,
    isPatron: activePatronGrant !== null,
    isAdmin: UserPolicy.isAdmin(user.role),
    isDeleted: user.isDeleted,
    language: user.language,
  };
}
