export type NotificationKind = "welcome" | "support" | "system" | "comment" | "patron";

/**
 * Public notification shape. Mock data today; a real backend
 * (e.g. lib/modules/notifications) must return this exact shape so the
 * UI in NotificationsMenu.tsx needs no changes when it is wired up.
 */
export interface NotificationDTO {
  id: string;
  kind: NotificationKind;
  titlePl: string;
  titleEn: string;
  bodyPl: string;
  bodyEn: string;
  /** ISO 8601 timestamp. */
  createdAt: string;
  read: boolean;
  href?: string | null;
}
