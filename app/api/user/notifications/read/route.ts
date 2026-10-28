import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/errors";
import { invalidRequest, privateNotificationResponse, viewerNotificationsContext } from "@/lib/api/viewer-notifications-route";
import { markNotificationsRead, markNotificationsReadSchema } from "@/lib/modules/notifications";

export const dynamic = "force-dynamic";

/**
 * Marks notifications as read: `{ "id": "<notification id>" }` for one of the caller's own, or
 * `{ "all": true, "before": "<snapshotAt>" }` for unread rows visible at that snapshot (before is optional). Idempotent. Answers `{ updated, unreadCount }`.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await viewerNotificationsContext("write");
    if ("response" in session) return session.response;

    const parsed = markNotificationsReadSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return invalidRequest('Send { "id": "..." } or { "all": true }.');

    const result = await markNotificationsRead(session.ctx, parsed.data);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return privateNotificationResponse(handleApiError(error));
  }
}
