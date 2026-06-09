import { AppContext } from "@/lib/modules/shared/app-context";
import { getUserAccessProfile, UserAccessProfileDto } from "./get-user-access-profile.use-case";

export async function getActorAccessProfile(
  ctx: AppContext
): Promise<UserAccessProfileDto | null> {
  const { actor } = ctx;

  if (actor.type === 'guest' || actor.type === 'system') {
    return null;
  }

  const profile = await getUserAccessProfile(ctx, actor.userId);

  if (!profile || profile.isDeleted) {
    return null;
  }

  // If actor is admin, but profile is not, trust the profile role for access decisions
  // or handle as inconsistent state.
  // In our case, isAdmin in profile is derived from DB role.

  return profile;
}
