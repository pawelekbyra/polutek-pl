import { NotificationKind } from "@prisma/client";

export type PublicNotificationKind = "welcome" | "system" | "comment" | "support" | "patron";

const KIND_TO_PUBLIC: Record<NotificationKind, PublicNotificationKind> = {
  WELCOME: "welcome",
  SYSTEM: "system",
  COMMENT: "comment",
  SUPPORT: "support",
  PATRON: "patron",
};

export function toPublicKind(kind: NotificationKind): PublicNotificationKind {
  return KIND_TO_PUBLIC[kind];
}

export interface NotificationDTO {
  id: string;
  kind: PublicNotificationKind;
  titlePl: string;
  titleEn: string;
  bodyPl: string;
  bodyEn: string;
  createdAt: string;
  read: boolean;
  href?: string | null;
}

export interface NotificationPreferencesDTO {
  patronEnabled: boolean;
  commentEnabled: boolean;
  systemEnabled: boolean;
}

export interface AdminNotificationListItemDTO {
  id: string;
  kind: NotificationKind;
  titlePl: string;
  read: boolean;
  createdAt: string;
  userEmail: string | null;
}

export interface NotificationTemplateDTO {
  kind: NotificationKind;
  titlePl: string;
  titleEn: string;
  bodyPl: string;
  bodyEn: string;
  isCustomized: boolean;
  updatedAt: string | null;
}
