import { AppContext } from "@/lib/modules/shared/app-context";
import { UserRepository } from "../infrastructure/user.repository";
import { SystemRole } from "@prisma/client";

export interface UserAccessProfileDto {
  id: string;
  email: string | null;
  role: SystemRole;
  isAdmin: boolean;
  isDeleted: boolean;
  language: string | null;
}

/**
 * getUserAccessProfile provides a standardized read model for access decisions.
 * It strictly reads from the local database (source of truth). Whether the user ever tipped is
 * deliberately not part of it: access never depends on payments.
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
    email: user.email,
    role: user.role,
    isAdmin: user.role === SystemRole.ADMIN,
    isDeleted: user.isDeleted,
    language: user.language,
  };
}
