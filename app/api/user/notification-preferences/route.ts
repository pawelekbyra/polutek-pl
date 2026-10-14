import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { invalidRequest, viewerNotificationsContext } from "@/lib/api/viewer-notifications-route";
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  updateNotificationPreferencesSchema,
} from "@/lib/modules/notifications";

export const dynamic = "force-dynamic";

/** The viewer's notification toggles plus the read-only `emailConsent` (content-mail consent). */
export async function GET() {
  try {
    const session = await viewerNotificationsContext("read");
    if ("response" in session) return session.response;
    const preferences = await getNotificationPreferences(session.ctx);
    return NextResponse.json(preferences, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Saves any of `newVideoInApp`, `newVideoEmail`, `commentEnabled`, `systemEnabled` (booleans, at least
 * one, no other keys). Changing `newVideoEmail` never grants mailing consent: that stays with the
 * subscribe and unsubscribe flows.
 */
export async function PATCH(req: NextRequest) {
  try {
    const session = await viewerNotificationsContext("write");
    if ("response" in session) return session.response;

    const parsed = updateNotificationPreferencesSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return invalidRequest("Send at least one boolean preference and no unknown fields.");

    const preferences = await updateNotificationPreferences(session.ctx, parsed.data);
    return NextResponse.json(preferences, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}
