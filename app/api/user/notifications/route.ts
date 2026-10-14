import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { invalidRequest, viewerNotificationsContext } from "@/lib/api/viewer-notifications-route";
import { listUserNotifications, listUserNotificationsQuerySchema } from "@/lib/modules/notifications";

export const dynamic = "force-dynamic";

/**
 * The signed-in viewer's notifications, newest first, in the language of `User.language`.
 * `?limit=` (1-50, default 20), `?cursor=` (`nextCursor` of the previous page), `?unread=1`.
 * Answers `{ items, nextCursor, unreadCount }`; `unreadCount` counts every unread row, not just the page.
 * Never cached: it is per viewer.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await viewerNotificationsContext("read");
    if ("response" in session) return session.response;

    const parsed = listUserNotificationsQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) return invalidRequest("Invalid query.", parsed.error.flatten().fieldErrors);

    const page = await listUserNotifications(session.ctx, {
      limit: parsed.data.limit,
      cursor: parsed.data.cursor,
      unreadOnly: parsed.data.unread,
    });
    return NextResponse.json(page, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}
