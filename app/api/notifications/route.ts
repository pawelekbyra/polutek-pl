import { getAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { NotificationDTO } from "@/app/types/notification";

export async function GET(request: NextRequest) {
  try {
    const { userId } = await getAuth(request);

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const limit = request.nextUrl.searchParams.get("limit") ?? "10";
    const limitNum = Math.min(Math.max(1, parseInt(limit) || 10), 100);

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limitNum,
    });

    const dtos: NotificationDTO[] = notifications.map((n) => ({
      id: n.id,
      kind: n.kind.toLowerCase() as any,
      titlePl: n.titlePl,
      titleEn: n.titleEn,
      bodyPl: n.bodyPl,
      bodyEn: n.bodyEn,
      createdAt: n.createdAt.toISOString(),
      read: n.read,
      href: n.href,
    }));

    return NextResponse.json(dtos);
  } catch (error) {
    console.error("[NOTIFICATIONS_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await getAuth(request);

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { id, read } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Missing notification id" },
        { status: 400 }
      );
    }

    const notification = await prisma.notification.update({
      where: { id },
      data: { read },
    });

    const dto: NotificationDTO = {
      id: notification.id,
      kind: notification.kind.toLowerCase() as any,
      titlePl: notification.titlePl,
      titleEn: notification.titleEn,
      bodyPl: notification.bodyPl,
      bodyEn: notification.bodyEn,
      createdAt: notification.createdAt.toISOString(),
      read: notification.read,
      href: notification.href,
    };

    return NextResponse.json(dto);
  } catch (error) {
    console.error("[NOTIFICATIONS_PUT_ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
