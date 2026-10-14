import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { viewerNotificationsContext } from "@/lib/api/viewer-notifications-route";
import { countUnreadNotifications } from "@/lib/modules/notifications";

export const dynamic = "force-dynamic";

/** The signed-in viewer's unread count only (`{ unreadCount }`): the cheap poll behind the bell badge. Never cached. */
export async function GET() {
  try {
    const session = await viewerNotificationsContext("read");
    if ("response" in session) return session.response;
    const unreadCount = await countUnreadNotifications(session.ctx);
    return NextResponse.json({ unreadCount }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}
