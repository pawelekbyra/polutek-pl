import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminForApi } from "@/lib/auth-utils";

type BroadcastAudience = "ALL" | "PATRONS";

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

  const where = {
    isDeleted: false,
    ...(audience === "PATRONS" ? { patronGrants: { some: { revokedAt: null } } } : {}),
  };

  const recipients = await prisma.user.findMany({
    where,
    select: {
      id: true,
      notificationPreference: { select: { systemEnabled: true } },
    },
  });

  const targetUserIds = recipients
    .filter((u) => u.notificationPreference?.systemEnabled !== false)
    .map((u) => u.id);

  if (targetUserIds.length === 0) {
    return NextResponse.json({ recipientCount: 0 });
  }

  await prisma.notification.createMany({
    data: targetUserIds.map((userId) => ({
      userId,
      kind: "SYSTEM" as const,
      titlePl,
      titleEn,
      bodyPl,
      bodyEn,
      href: href || null,
    })),
  });

  return NextResponse.json({ recipientCount: targetUserIds.length });
}
