import { NextRequest, NextResponse } from "next/server";
import { getActorFromAuth } from "@/lib/api/auth";
import { auth } from "@/lib/auth/server";
import { checkDeletionReauth, isLastAdmin } from "@/lib/auth/reauth";
import { rateLimit } from "@/lib/rate-limit";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { AccountDeletionCleanupUseCase } from "@/lib/modules/users";
import { handleApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

const REAUTH_STATUS = {
  PASSWORD_REQUIRED: 401,
  INVALID_PASSWORD: 403,
  REAUTH_REQUIRED: 403,
} as const;

/**
 * Irreversible, so a session alone is not enough (audit F-12): a password account must send its
 * password in the body, a Google-only account must have signed in within the last 10 minutes
 * (`REAUTH_REQUIRED`: the UI sends the user through Google again). The last administrator cannot
 * delete the account (`LAST_ADMIN`).
 */
export async function DELETE(req: NextRequest) {
  try {
    const actor = await getActorFromAuth({ allowGuest: false });
    if (actor.type !== "user" && actor.type !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Guessing the password here would otherwise be a free, uncaptcha'd oracle for a hijacked session.
    const limited = await rateLimit({ key: `account-delete:${actor.userId}`, limit: 5, windowMs: 15 * 60 * 1000 });
    if (!limited.success) {
      return NextResponse.json({ error: "TOO_MANY_ATTEMPTS" }, { status: 429 });
    }

    const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
    const session = await auth({ fresh: true });
    const reauth = await checkDeletionReauth({
      userId: actor.userId,
      sessionId: session.sessionId,
      password: typeof body?.password === "string" ? body.password : null,
    });
    if (reauth !== "ok") {
      return NextResponse.json({ error: reauth }, { status: REAUTH_STATUS[reauth] });
    }

    if (await isLastAdmin(actor.userId)) {
      return NextResponse.json({ error: "LAST_ADMIN" }, { status: 409 });
    }

    const ctx = createAppContext({
      actor: { type: "system", reason: "App-initiated account deletion cleanup" },
    });

    const cleanup = await AccountDeletionCleanupUseCase.execute(ctx, {
      userId: actor.userId,
      source: "APP_ACCOUNT_DELETION",
      reason: "App-initiated account deletion",
    });

    return NextResponse.json({ success: true, cleanup });
  } catch (error) {
    return handleApiError(error);
  }
}
