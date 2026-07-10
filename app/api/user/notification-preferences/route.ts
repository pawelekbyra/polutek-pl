import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getNotificationPreferences, updateNotificationPreferences } from "@/lib/modules/notifications";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prefs = await getNotificationPreferences(userId);
  return NextResponse.json(prefs);
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const patronEnabled = typeof body.patronEnabled === "boolean" ? body.patronEnabled : undefined;
  const commentEnabled = typeof body.commentEnabled === "boolean" ? body.commentEnabled : undefined;
  const systemEnabled = typeof body.systemEnabled === "boolean" ? body.systemEnabled : undefined;

  const prefs = await updateNotificationPreferences(userId, { patronEnabled, commentEnabled, systemEnabled });
  return NextResponse.json(prefs);
}
