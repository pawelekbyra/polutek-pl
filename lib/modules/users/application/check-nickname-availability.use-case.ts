import type { AppContext } from "@/lib/modules/shared/app-context";
import { validateNickname, type NicknameProblem } from "@/lib/auth/nickname";

export type NicknameAvailability = { available: true } | { available: false; reason: NicknameProblem };

/**
 * A nickname is free when it passes the format rules and no other active, onboarded user has the same
 * name (case-insensitive). Accounts still in onboarding only hold a placeholder (the local part of
 * their e-mail), which must neither block real nicknames nor reveal that such an account exists.
 * The database enforces the same rule (partial unique index "User_name_lower_active_key").
 */
export class CheckNicknameAvailabilityUseCase {
  static async execute(ctx: AppContext, rawName: string): Promise<NicknameAvailability> {
    const validation = validateNickname(rawName);
    if (!validation.ok) return { available: false, reason: validation.reason };

    const existing = await ctx.prisma.user.findFirst({
      where: { isDeleted: false, onboardingPending: false, name: { equals: validation.value, mode: "insensitive" } },
      select: { id: true },
    });
    return existing ? { available: false, reason: "taken" } : { available: true };
  }
}
