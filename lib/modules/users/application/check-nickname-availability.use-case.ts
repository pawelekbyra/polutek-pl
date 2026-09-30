import type { AppContext } from "@/lib/modules/shared/app-context";
import { validateNickname, type NicknameProblem } from "@/lib/auth/nickname";

export type NicknameAvailability = { available: true } | { available: false; reason: NicknameProblem };

/**
 * A nickname is free when it passes the format rules and no other non-deleted user has the same
 * name (case-insensitive). There is deliberately no DB unique constraint on `User.name`: existing
 * rows may already share names, so this check is the guard for new sign-ups only.
 */
export class CheckNicknameAvailabilityUseCase {
  static async execute(ctx: AppContext, rawName: string): Promise<NicknameAvailability> {
    const validation = validateNickname(rawName);
    if (!validation.ok) return { available: false, reason: validation.reason };

    const existing = await ctx.prisma.user.findFirst({
      where: { isDeleted: false, name: { equals: validation.value, mode: "insensitive" } },
      select: { id: true },
    });
    return existing ? { available: false, reason: "taken" } : { available: true };
  }
}
