import { AppContext } from "@/lib/modules/shared/app-context";
import { UserDeletedError, UserNotFoundError } from "../domain/user.errors";

/**
 * Better Auth creates the `User` row when the account is created (sign-up or first Google
 * sign-in), so there is nothing left to "create" here. The name is kept because it is the single
 * entry point route handlers and pages already use: it loads the local row of a signed-in user
 * and fails closed when the row is missing or soft-deleted.
 */
export async function getOrCreateCurrentUser(
  ctx: AppContext,
  userId: string,
  _legacyClaims?: unknown,
) {
  const user = await ctx.prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new UserNotFoundError(userId);
  if (user.isDeleted) throw new UserDeletedError(userId);
  return user;
}
