import { NextRequest, NextResponse } from "next/server";
import { getActorFromAuth } from "@/lib/api/auth";
import { createAppContext } from "@/lib/modules/shared/app-context";
import { completeOnboarding } from "@/lib/modules/users";
import { notifyOwnerOfNewUser, resolveEmailLanguage, sendWelcomeEmail } from "@/lib/modules/email";
import { sendNotification, notificationTemplates } from "@/lib/modules/notifications";
import { handleApiError } from "@/lib/errors";
import { isLocale } from "@/lib/i18n/routing";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** First-sign-in step for Google accounts: nickname + optional avatar, then the welcome e-mail. */
export async function POST(req: NextRequest) {
  try {
    const actor = await getActorFromAuth({ allowGuest: false });
    if (actor.type !== "user" && actor.type !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = (await req.json().catch(() => null)) as { nickname?: unknown; avatarDataUrl?: unknown; language?: unknown } | null;
    if (typeof body?.nickname !== "string") {
      return NextResponse.json({ error: "INVALID_NICKNAME" }, { status: 400 });
    }
    const user = await completeOnboarding(createAppContext({ actor }), {
      userId: actor.userId,
      nickname: body.nickname,
      avatarDataUrl: typeof body.avatarDataUrl === "string" ? body.avatarDataUrl : null,
      language: isLocale(body.language) ? body.language : undefined,
    });
    // Older accounts that are only asked for a (new) nickname were welcomed long ago.
    const isNewAccount = Date.now() - user.createdAt.getTime() < 24 * 60 * 60 * 1000;
    if (isNewAccount) {
      // The welcome in the bell: every new account gets it, whatever way it signed up (never gated by a preference).
      void sendNotification({ userId: actor.userId, ...notificationTemplates.welcome, href: "/" });
      void sendWelcomeEmail(user.email, resolveEmailLanguage(user.language)).catch((error) => {
        logger.error("[onboarding] welcome email failed", error instanceof Error ? error.message : String(error));
      });
      void notifyOwnerOfNewUser({ userId: actor.userId, email: user.email, nickname: user.name, language: user.language, createdAt: user.createdAt }).catch((error) => {
        logger.error("[onboarding] new-user notification failed", error instanceof Error ? error.message : String(error));
      });
    }
    return NextResponse.json({ success: true, name: user.name });
  } catch (error) {
    return handleApiError(error);
  }
}
