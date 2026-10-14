import { NextResponse } from "next/server";
import { getActorFromAuth } from "@/lib/api/auth";
import { rateLimit } from "@/lib/rate-limit";
import { createAppContext, type AppContext } from "@/lib/modules/shared/app-context";
import { AppError } from "@/lib/modules/shared/app-error";

/**
 * Shared front of the signed-in viewer's notification routes (`/api/user/notifications*`,
 * `/api/user/notification-preferences`): the session actor, a per-user rate limit and the app context.
 * Mutating requests are additionally origin-checked by middleware.ts (every `/api/user/*` write).
 */
export async function viewerNotificationsContext(
  action: "read" | "write",
): Promise<{ ctx: AppContext } | { response: NextResponse }> {
  const actor = await getActorFromAuth({ allowGuest: false });
  if (actor.type !== "user" && actor.type !== "admin") throw new AppError("Unauthorized", 401, "UNAUTHORIZED");

  const limit = await rateLimit({
    key: `viewer-notifications:${action}:${actor.userId}`,
    limit: action === "read" ? 240 : 60,
    windowMs: 60 * 1000,
  });
  if (!limit.success) {
    return { response: NextResponse.json({ error: "RATE_LIMITED", message: "Too many requests. Please try again shortly." }, { status: 429 }) };
  }
  return { ctx: createAppContext({ actor }) };
}

export function invalidRequest(message: string, details?: unknown) {
  return NextResponse.json({ error: "INVALID_REQUEST", message, ...(details ? { details } : {}) }, { status: 400 });
}
