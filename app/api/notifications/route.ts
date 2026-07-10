import { getAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { listUserNotifications, markNotificationRead } from "@/lib/modules/notifications";

export async function GET(request: NextRequest) {
  const { userId } = await getAuth(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) || 10 : 10;

  const notifications = await listUserNotifications(userId, limit);
  return NextResponse.json(notifications);
}

export async function PUT(request: NextRequest) {
  const { userId } = await getAuth(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { id, read } = body as { id?: string; read?: boolean };

  if (!id) {
    return NextResponse.json({ error: "Missing notification id" }, { status: 400 });
  }

  const notification = await markNotificationRead(userId, id, read ?? true);
  if (!notification) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(notification);
}
