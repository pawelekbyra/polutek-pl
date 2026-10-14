import { z } from "zod";
import type { NotificationKind } from "@prisma/client";

/** The viewer's own notification feed (the bell). Pure: schemas, DTOs and the link rule. */

export const USER_NOTIFICATIONS_DEFAULT_LIMIT = 20;
export const USER_NOTIFICATIONS_MAX_LIMIT = 50;

export const listUserNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(USER_NOTIFICATIONS_MAX_LIMIT).default(USER_NOTIFICATIONS_DEFAULT_LIMIT),
  cursor: z.string().trim().min(1).max(64).optional(),
  unread: z
    .enum(["1", "true", "0", "false"])
    .optional()
    .transform((value) => value === "1" || value === "true"),
});
export type ListUserNotificationsQuery = z.infer<typeof listUserNotificationsQuerySchema>;

/** Mark one notification (`id`) or every unread one (`all`) as read. */
export const markNotificationsReadSchema = z.union([
  z.object({ id: z.string().trim().min(1).max(64) }).strict(),
  z.object({ all: z.literal(true) }).strict(),
]);
export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;

export interface UserNotificationDTO {
  id: string;
  kind: NotificationKind;
  /** Already in the viewer's language (Polish or English). */
  title: string;
  body: string;
  /** In-site path or https address; null when the notification has no (safe) link. */
  href: string | null;
  read: boolean;
  createdAt: string;
}

export interface UserNotificationPage {
  items: UserNotificationDTO[];
  /** Pass as `cursor` for the next page; null on the last page. */
  nextCursor: string | null;
  unreadCount: number;
}

/**
 * A notification link is either a path on this site or an https address (admin broadcasts may point
 * outside). Anything else (`javascript:`, `data:`, protocol-relative `//host`) is dropped.
 */
export function safeNotificationHref(href: string | null | undefined): string | null {
  if (!href) return null;
  const value = href.trim();
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
  if (/^https:\/\/[^\s/]+/i.test(value)) return value;
  return null;
}

/** `User.language` is any of eight codes; notifications exist in Polish and English only. */
export function notificationLanguage(language: string | null | undefined): "pl" | "en" {
  return language === "pl" ? "pl" : "en";
}
