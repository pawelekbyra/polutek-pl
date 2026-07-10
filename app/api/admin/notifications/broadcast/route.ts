import { NextRequest, NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth-utils";
import { broadcastNotification, type BroadcastAudience } from "@/lib/modules/notifications";

export async function POST(req: NextRequest) {
  const { response } = await requireAdminForApi("POST_ADMIN_NOTIFICATIONS_BROADCAST");
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const { titlePl, titleEn, bodyPl, bodyEn, audience, href } = body as {
    titlePl?: string;
    titleEn?: string;
    bodyPl?: string;
    bodyEn?: string;
    audience?: BroadcastAudience;
    href?: string;
  };

  if (!titlePl || !titleEn || !bodyPl || !bodyEn) {
    return NextResponse.json({ error: "All PL/EN fields are required" }, { status: 400 });
  }
  if (audience !== "ALL" && audience !== "PATRONS") {
    return NextResponse.json({ error: "Invalid audience" }, { status: 400 });
  }

  const result = await broadcastNotification({ titlePl, titleEn, bodyPl, bodyEn, audience, href });
  return NextResponse.json(result);
}
