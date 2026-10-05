import { AppContext } from "@/lib/modules/shared/app-context";
import { UseCaseResult, ok, fail } from "@/lib/modules/shared/result";
import { InvalidPatronActionError, UserNotFoundError } from "../domain/patron.errors";
import { PatronPolicy } from "../domain/patron.policy";
import { PatronRepository } from "../infrastructure/patron.repository";
import { grantPatron } from "./grant-patron.use-case";
import { revokePatron } from "./revoke-patron.use-case";

export const SUPPORTER_REASON_MIN = 3;
export const SUPPORTER_REASON_MAX = 300;

/**
 * The owner sets or removes the supporter marker of one account by hand (profile dialog "Znacznik wspierającego").
 * The marker is only a note visible to admins (no access, no badge). A reason is mandatory and is stored on the
 * grant and in the audit row. Idempotent by state: granting when an active ADMIN grant exists, or removing when no
 * grant is active, changes nothing (`changed: false`, no audit row). Removing ends ALL active grants of the
 * account (also the ones a tip created), exactly like `revokePatron`; the dialog says so.
 */
export async function adminSetSupporter(
  ctx: AppContext,
  input: { userId: string; action: "grant" | "revoke"; reason: string },
): Promise<UseCaseResult<{ changed: boolean; isSupporter: boolean }, InvalidPatronActionError | UserNotFoundError>> {
  if (!PatronPolicy.canGrantPatron(ctx.actor) || ctx.actor.type !== "admin") return fail(new InvalidPatronActionError("Brak uprawnień administratora."));
  const reason = input.reason.trim();
  if (reason.length < SUPPORTER_REASON_MIN || reason.length > SUPPORTER_REASON_MAX) {
    return fail(new InvalidPatronActionError(`Podaj powód (${SUPPORTER_REASON_MIN}-${SUPPORTER_REASON_MAX} znaków).`));
  }

  const user = await ctx.prisma.user.findUnique({ where: { id: input.userId }, select: { isDeleted: true } });
  if (!user) return fail(new UserNotFoundError(input.userId));
  if (user.isDeleted) return fail(new InvalidPatronActionError("Konto jest usunięte."));
  const active = await new PatronRepository().listActiveGrants(input.userId, ctx.db.read);

  if (input.action === "grant") {
    const hadAdminGrant = active.some((g) => g.source === "ADMIN");
    const result = await grantPatron({ userId: input.userId, source: "admin", grantedByUserId: ctx.actor.userId, note: reason }, ctx);
    if (!result.ok) return result;
    return ok({ changed: !hadAdminGrant, isSupporter: result.data.isPatron });
  }

  if (active.length === 0) return ok({ changed: false, isSupporter: false });
  const result = await revokePatron({ userId: input.userId, note: reason, reason }, ctx);
  if (!result.ok) return result;
  return ok({ changed: true, isSupporter: result.data.isPatron });
}
