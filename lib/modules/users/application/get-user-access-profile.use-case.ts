import { AppContext } from "@/lib/modules/shared/app-context";
import { UserRepository } from "../infrastructure/user.repository";
import { UserPolicy } from "../domain/user.policy";
import { SystemRole } from "@prisma/client";

export interface UserAccessProfileDto {
  id: string;
  clerkId: string;
  email: string | null;
  role: SystemRole;
  isPatron: boolean;
  isAdmin: boolean;
  isDeleted: boolean;
  language: string | null;
}

/**
 * getUserAccessProfile provides a standardized read model for access decisions.
 * It strictly reads from the local database (source of truth).
 */
export async function getUserAccessProfile(
  ctx: AppContext,
  userId: string
): Promise<UserAccessProfileDto | null> {
  const repository = new UserRepository(ctx.prisma);
  const user = await repository.findById(userId);

  if (!user) return null;

  return {
    id: user.id,
    clerkId: user.id, // In this system, userId IS clerkId
    email: user.email,
    role: user.role,
    isPatron: UserPolicy.isPatron(user.isPatron),
    isAdmin: UserPolicy.isAdmin(user.role),
    isDeleted: user.isDeleted,
    language: user.language,
  };
}
