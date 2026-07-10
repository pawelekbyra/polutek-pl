import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

const DEFAULTS = { patronEnabled: true, commentEnabled: true, systemEnabled: true };

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pref = await prisma.notificationPreference.findUnique({ where: { userId } });

  return NextResponse.json({
    patronEnabled: pref?.patronEnabled ?? DEFAULTS.patronEnabled,
    commentEnabled: pref?.commentEnabled ?? DEFAULTS.commentEnabled,
    systemEnabled: pref?.systemEnabled ?? DEFAULTS.systemEnabled,
  });
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const patronEnabled = typeof body.patronEnabled === "boolean" ? body.patronEnabled : undefined;
  const commentEnabled = typeof body.commentEnabled === "boolean" ? body.commentEnabled : undefined;
  const systemEnabled = typeof body.systemEnabled === "boolean" ? body.systemEnabled : undefined;

  const pref = await prisma.notificationPreference.upsert({
    where: { userId },
    create: {
      userId,
      patronEnabled: patronEnabled ?? DEFAULTS.patronEnabled,
      commentEnabled: commentEnabled ?? DEFAULTS.commentEnabled,
      systemEnabled: systemEnabled ?? DEFAULTS.systemEnabled,
    },
    update: {
      ...(patronEnabled !== undefined && { patronEnabled }),
      ...(commentEnabled !== undefined && { commentEnabled }),
      ...(systemEnabled !== undefined && { systemEnabled }),
    },
  });

  return NextResponse.json({
    patronEnabled: pref.patronEnabled,
    commentEnabled: pref.commentEnabled,
    systemEnabled: pref.systemEnabled,
  });
}
