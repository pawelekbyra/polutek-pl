import { NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { broadcastNotification } from "@/lib/modules/notifications";
import { parseAdminBody } from "@/lib/api/admin-body";
import { adminNotificationBroadcastSchema } from "@/lib/api/admin-schemas";

export async function POST(req: NextRequest) {
  const { response } = await requireAdminForApi("POST_ADMIN_NOTIFICATIONS_BROADCAST");
  if (response) return response;

  const parsed = await parseAdminBody(req, adminNotificationBroadcastSchema);
  if (!parsed.ok) return parsed.response;
  const { titlePl, titleEn, bodyPl, bodyEn, audience, href } = parsed.data;

  const result = await broadcastNotification({ titlePl, titleEn, bodyPl, bodyEn, audience, href });
  return NextResponse.json(result);
}
