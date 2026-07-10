import { NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { listAdminNotifications } from "@/lib/modules/notifications";

export async function GET() {
  const { response } = await requireAdminForApi("GET_ADMIN_NOTIFICATIONS");
  if (response) return response;

  const notifications = await listAdminNotifications(50);
  return NextResponse.json(notifications);
}
