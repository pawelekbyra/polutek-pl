import { createScopedLogger } from "@/lib/logger";
import { NextResponse, NextRequest } from "next/server";
import { getCorrelationId } from "@/lib/utils/correlation";
import { auth } from "@/lib/auth/server";
import { handleApiError } from "@/lib/errors";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { updateUserLanguage } from "@/lib/modules/users";
import { getActorFromAuth } from "@/lib/api/auth";
import { isLocale } from "@/lib/i18n/routing";

export const dynamic = "force-dynamic";

/**
 * Saves the signed-in viewer's site and e-mail language (`User.language`). The one write path for
 * it, called by AuthLifecycleProvider on every change; same-origin only (middleware.ts guards
 * every mutating /api/user/* request).
 */
export async function PATCH(req: NextRequest) {
  const requestId = getCorrelationId();
  const scopedLogger = createScopedLogger(requestId);

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { language?: unknown } | null;
  const language = body?.language;
  if (!isLocale(language)) {
    return NextResponse.json({ error: "Invalid language" }, { status: 400 });
  }

  try {
    const actor = await getActorFromAuth();
    const ctx = createAppContext({ actor, requestId: requestId || undefined });

    await updateUserLanguage(ctx, { userId, language });

    return NextResponse.json({ success: true });
  } catch (err) {
    scopedLogger.error("[LANGUAGE_UPDATE_ERROR]", err);
    return handleApiError(err);
  }
}
