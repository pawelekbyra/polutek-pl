import { NextRequest, NextResponse } from "next/server";
import { NotificationKind } from "@prisma/client";
import { requireAdminForApi } from "@/lib/auth-utils";
import {
  listNotificationTemplates,
  upsertNotificationTemplate,
  resetNotificationTemplate,
  NOTIFICATION_TEMPLATE_KINDS,
} from "@/lib/modules/notifications";

function isNotificationKind(value: unknown): value is NotificationKind {
  return typeof value === "string" && (NOTIFICATION_TEMPLATE_KINDS as string[]).includes(value);
}

export async function GET() {
  const { response } = await requireAdminForApi("GET_ADMIN_NOTIFICATION_TEMPLATES");
  if (response) return response;

  const templates = await listNotificationTemplates();
  return NextResponse.json(templates);
}

export async function PUT(req: NextRequest) {
  const { adminUserId, response } = await requireAdminForApi("PUT_ADMIN_NOTIFICATION_TEMPLATES");
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const { kind, titlePl, titleEn, bodyPl, bodyEn } = body;

  if (!isNotificationKind(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }
  if (!titlePl || !titleEn || !bodyPl || !bodyEn) {
    return NextResponse.json({ error: "All PL/EN fields are required" }, { status: 400 });
  }

  const template = await upsertNotificationTemplate({
    kind,
    titlePl,
    titleEn,
    bodyPl,
    bodyEn,
    updatedByAdminId: adminUserId,
  });

  return NextResponse.json(template);
}

export async function DELETE(req: NextRequest) {
  const { response } = await requireAdminForApi("DELETE_ADMIN_NOTIFICATION_TEMPLATES");
  if (response) return response;

  const kind = req.nextUrl.searchParams.get("kind");
  if (!isNotificationKind(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  await resetNotificationTemplate(kind);
  return NextResponse.json({ success: true });
}
