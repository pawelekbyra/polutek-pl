import { AppContext } from "@/lib/modules/shared/app-context";
import { UserRepository } from "../infrastructure/user.repository";
import { UserPolicy } from "../domain/user.policy";
import { SystemRole } from "@prisma/client";

export interface UserAccessProfile {
  userId: string;
  role: SystemRole;
  isPatron: boolean;
  isAdmin: boolean;
  isDeleted: boolean;
}

export async function getUserAccessProfile(
  ctx: AppContext,
  userId: string
): Promise<UserAccessProfile | null> {
  const repository = new UserRepository(ctx.prisma);
  const user = await repository.findById(userId);

  if (!user) return null;

  return {
    userId: user.id,
    role: user.role,
    isPatron: UserPolicy.isPatron(user.isPatron),
    isAdmin: UserPolicy.isAdmin(user.role),
    isDeleted: user.isDeleted,
  };
}
