import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminForApi } from "@/lib/auth-utils";

export async function GET() {
  const { response } = await requireAdminForApi("GET_ADMIN_NOTIFICATIONS");
  if (response) return response;

  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { email: true, name: true } } },
  });

  return NextResponse.json(
    notifications.map((n) => ({
      id: n.id,
      kind: n.kind,
      titlePl: n.titlePl,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
      userEmail: n.user?.email ?? null,
    })),
  );
}
