import { NotificationKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/lib/modules/audit";
import { resolveAdminAuditContext } from "@/lib/modules/audit";
import { NotificationTemplateDTO } from "../domain/notification.dto";
import { notificationTemplates } from "./send-notification.use-case";

const DEFAULTS: Record<NotificationKind, { titlePl: string; titleEn: string; bodyPl: string; bodyEn: string }> = {
  WELCOME: notificationTemplates.welcome,
  PATRON: notificationTemplates.supportThanks,
  COMMENT: notificationTemplates.commentLike,
  SYSTEM: { titlePl: "Wiadomość systemowa", titleEn: "System message", bodyPl: "", bodyEn: "" },
  SUPPORT: { titlePl: "Wsparcie", titleEn: "Support", bodyPl: "", bodyEn: "" },
  NEW_VIDEO: { titlePl: "Nowy film", titleEn: "New video", bodyPl: "", bodyEn: "" },
  MODERATION: { titlePl: "Decyzja moderacji", titleEn: "Moderation decision", bodyPl: "", bodyEn: "" },
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

  const ctx = await resolveAdminAuditContext(updatedByAdminId);

  return prisma.$transaction(async (tx) => {
    const template = await tx.notificationTemplate.upsert({
      where: { kind },
      create: { kind, titlePl, titleEn, bodyPl, bodyEn, updatedBy: updatedByAdminId },
      update: { titlePl, titleEn, bodyPl, bodyEn, updatedBy: updatedByAdminId },
    });
    await recordAuditEvent(ctx, {
      action: "NOTIFICATION_TEMPLATE_SAVED",
      targetType: "NotificationTemplate",
      targetId: kind,
    }, tx);
    return template;
  });
}

export async function resetNotificationTemplate(kind: NotificationKind): Promise<void> {
  const ctx = await resolveAdminAuditContext();

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.notificationTemplate.deleteMany({ where: { kind } });
    await recordAuditEvent(ctx, {
      action: "NOTIFICATION_TEMPLATE_RESET",
      targetType: "NotificationTemplate",
      targetId: kind,
      metadata: { hadOverride: count > 0 },
    }, tx);
  });
}
