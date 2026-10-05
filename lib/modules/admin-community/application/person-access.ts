import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { AppError } from "@/lib/modules/shared/app-error";
import { recordAuditEvent } from "@/lib/modules/audit";
import { UserNotFoundError } from "@/lib/modules/users";
import { explainAccess, type AccessExplanation } from "../domain/access-explanation";

/**
 * "Podgląd jako ta osoba": a read-only explanation of what the person can watch and do, computed with the site's
 * own rules. Nothing is impersonated and no session is issued. It reads a person's data on purpose, so each call
 * writes an ADMIN_VIEW_AS audit row (who looked at whom).
 */
export async function viewAsPerson(ctx: AppContext, userId: string): Promise<UseCaseResult<AccessExplanation, AppError>> {
  if (ctx.actor.type !== "admin") return fail(new AppError("Brak uprawnień administratora.", 403, "FORBIDDEN"));
  const user = await ctx.prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, isDeleted: true, emailVerified: true, onboardingPending: true, commentMutedUntil: true } });
  if (!user) return fail(new UserNotFoundError(userId));
  const videos = await ctx.prisma.video.findMany({
    where: { status: "PUBLISHED", publishedAt: { lte: ctx.now() } },
    orderBy: { publishedAt: "desc" },
    take: 60,
    select: { id: true, slug: true, title: true, tier: true },
  });
  await recordAuditEvent(ctx, { action: "ADMIN_VIEW_AS", targetType: "User", targetId: userId, metadata: { films: videos.length } });
  return ok(explainAccess(user, videos, ctx.now()));
}
