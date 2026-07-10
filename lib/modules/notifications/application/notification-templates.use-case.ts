import { NotificationKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotificationTemplateDTO } from "../domain/notification.dto";
import { notificationTemplates } from "./send-notification.use-case";

const DEFAULTS: Record<NotificationKind, { titlePl: string; titleEn: string; bodyPl: string; bodyEn: string }> = {
  WELCOME: notificationTemplates.welcome,
  PATRON: notificationTemplates.patronAccess,
  COMMENT: notificationTemplates.commentLike,
  SYSTEM: { titlePl: "Wiadomość systemowa", titleEn: "System message", bodyPl: "", bodyEn: "" },
  SUPPORT: { titlePl: "Wsparcie", titleEn: "Support", bodyPl: "", bodyEn: "" },
};

export const NOTIFICATION_TEMPLATE_KINDS = Object.keys(DEFAULTS) as NotificationKind[];

export async function listNotificationTemplates(): Promise<NotificationTemplateDTO[]> {
  const overrides = await prisma.notificationTemplate.findMany();
  const overrideByKind = new Map(overrides.map((o) => [o.kind, o]));

  return NOTIFICATION_TEMPLATE_KINDS.map((kind) => {
    const override = overrideByKind.get(kind);
    const fallback = DEFAULTS[kind];
    return {
      kind,
      titlePl: override?.titlePl ?? fallback.titlePl,
      titleEn: override?.titleEn ?? fallback.titleEn,
      bodyPl: override?.bodyPl ?? fallback.bodyPl,
      bodyEn: override?.bodyEn ?? fallback.bodyEn,
      isCustomized: Boolean(override),
      updatedAt: override?.updatedAt.toISOString() ?? null,
    };
  });
}

export interface UpsertNotificationTemplateInput {
  kind: NotificationKind;
  titlePl: string;
  titleEn: string;
  bodyPl: string;
  bodyEn: string;
  updatedByAdminId: string;
}

export async function upsertNotificationTemplate(input: UpsertNotificationTemplateInput) {
  const { kind, titlePl, titleEn, bodyPl, bodyEn, updatedByAdminId } = input;

  return prisma.notificationTemplate.upsert({
    where: { kind },
    create: { kind, titlePl, titleEn, bodyPl, bodyEn, updatedBy: updatedByAdminId },
    update: { titlePl, titleEn, bodyPl, bodyEn, updatedBy: updatedByAdminId },
  });
}

export async function resetNotificationTemplate(kind: NotificationKind): Promise<void> {
  await prisma.notificationTemplate.deleteMany({ where: { kind } });
}
