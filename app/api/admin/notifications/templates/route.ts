import { NextRequest, NextResponse } from "next/server";
import { NotificationKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdminForApi } from "@/lib/auth-utils";
import { notificationTemplates } from "@/lib/modules/notifications/application/send-notification.use-case";

const DEFAULTS: Record<NotificationKind, { titlePl: string; titleEn: string; bodyPl: string; bodyEn: string }> = {
  WELCOME: notificationTemplates.welcome,
  PATRON: notificationTemplates.patronAccess,
  COMMENT: notificationTemplates.commentLike,
  SYSTEM: { titlePl: "Wiadomość systemowa", titleEn: "System message", bodyPl: "", bodyEn: "" },
  SUPPORT: { titlePl: "Wsparcie", titleEn: "Support", bodyPl: "", bodyEn: "" },
};

const KINDS = Object.keys(DEFAULTS) as NotificationKind[];

export async function GET() {
  const { response } = await requireAdminForApi("GET_ADMIN_NOTIFICATION_TEMPLATES");
  if (response) return response;

  const overrides = await prisma.notificationTemplate.findMany();
  const overrideByKind = new Map(overrides.map((o) => [o.kind, o]));

  const templates = KINDS.map((kind) => {
    const override = overrideByKind.get(kind);
    const fallback = DEFAULTS[kind];
    return {
      kind,
      titlePl: override?.titlePl ?? fallback.titlePl,
      titleEn: override?.titleEn ?? fallback.titleEn,
      bodyPl: override?.bodyPl ?? fallback.bodyPl,
      bodyEn: override?.bodyEn ?? fallback.bodyEn,
      isCustomized: Boolean(override),
      updatedAt: override?.updatedAt ?? null,
    };
  });

  return NextResponse.json(templates);
}

export async function PUT(req: NextRequest) {
  const { adminUserId, response } = await requireAdminForApi("PUT_ADMIN_NOTIFICATION_TEMPLATES");
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const { kind, titlePl, titleEn, bodyPl, bodyEn } = body;

  if (!KINDS.includes(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }
  if (!titlePl || !titleEn || !bodyPl || !bodyEn) {
    return NextResponse.json({ error: "All PL/EN fields are required" }, { status: 400 });
  }

  const template = await prisma.notificationTemplate.upsert({
    where: { kind },
    create: { kind, titlePl, titleEn, bodyPl, bodyEn, updatedBy: adminUserId },
    update: { titlePl, titleEn, bodyPl, bodyEn, updatedBy: adminUserId },
  });

  return NextResponse.json(template);
}

export async function DELETE(req: NextRequest) {
  const { response } = await requireAdminForApi("DELETE_ADMIN_NOTIFICATION_TEMPLATES");
  if (response) return response;

  const kind = req.nextUrl.searchParams.get("kind") as NotificationKind | null;
  if (!kind || !KINDS.includes(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  await prisma.notificationTemplate.deleteMany({ where: { kind } });

  return NextResponse.json({ success: true });
}
