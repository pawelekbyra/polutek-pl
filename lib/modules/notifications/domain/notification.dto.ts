import { NotificationKind } from "@prisma/client";

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
