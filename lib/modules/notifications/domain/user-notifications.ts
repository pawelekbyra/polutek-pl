import { z } from "zod";
import type { NotificationKind } from "@prisma/client";
import { NOTIFICATION_LANGUAGES } from "./notification-render";

/** The viewer's own notification feed (the bell). Pure: schemas, DTOs and the link rule. */

export const USER_NOTIFICATIONS_DEFAULT_LIMIT = 20;
export const USER_NOTIFICATIONS_MAX_LIMIT = 50;

export const listUserNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(USER_NOTIFICATIONS_MAX_LIMIT).default(USER_NOTIFICATIONS_DEFAULT_LIMIT),
  cursor: z.string().trim().min(1).max(160).optional(),
  language: z.enum(NOTIFICATION_LANGUAGES).optional(),
  ids: z.string().max(3300).optional().transform((value) => value?.split(",").filter(Boolean)).refine((value) => !value || (value.length > 0 && value.length <= 50 && value.every((id) => id.length <= 64 && /^[A-Za-z0-9_-]+$/.test(id))), "Invalid notification ids"),
  unread: z
    .enum(["1", "true", "0", "false"])
    .optional()
    .transform((value) => value === "1" || value === "true"),
});
export type ListUserNotificationsQuery = z.infer<typeof listUserNotificationsQuerySchema>;

/** Mark one notification (`id`) or every unread one (`all`) as read. */
export const markNotificationsReadSchema = z.union([
  z.object({ id: z.string().trim().min(1).max(64), read: z.boolean().optional() }).strict(),
  z.object({ all: z.literal(true), before: z.string().datetime().optional() }).strict(),
]);
export type MarkNotificationsReadInput = z.infer<typeof markNotificationsReadSchema>;

export const USER_NOTIFICATION_TYPES = ["welcome", "support", "comment_reply", "creator_like", "comment_like", "new_video", "premiere", "moderation", "announcement", "notification"] as const;
export type UserNotificationType = (typeof USER_NOTIFICATION_TYPES)[number];

/** Presentation semantics are stable across languages; storage kinds remain unchanged. */
export function userNotificationType(kind: NotificationKind, templateKey?: string | null, params?: unknown): UserNotificationType {
  // Static administrator overrides have no render key, but retain the event identity internally.
  const eventType = params && typeof params === "object" && !Array.isArray(params) ? (params as Record<string, unknown>).eventType : null;
  const key = templateKey ?? (typeof eventType === "string" ? eventType : null);
  if (kind === "COMMENT") {
    if (key === "creator_like" || key === "comment_like") return key;
    return "comment_reply";
  }
  if (kind === "NEW_VIDEO") return key === "premiere" ? "premiere" : "new_video";
  if (kind === "WELCOME") return "welcome";
  if (kind === "PATRON" || kind === "SUPPORT") return "support";
  if (kind === "MODERATION") return "moderation";
  if (kind === "SYSTEM") return "announcement";
  return "notification";
}

export type UserNotificationCursor = { createdAt: Date; id: string };

/** Keyset cursor survives retention deleting the row at the page boundary. */
export function encodeUserNotificationCursor(row: UserNotificationCursor): string {
  return `v1:${row.createdAt.getTime()}:${row.id}`;
}

/** Returns null for legacy id cursors; malformed versioned cursors are rejected by the use case. */
export function decodeUserNotificationCursor(value: string): UserNotificationCursor | null {
  const match = /^v1:(\d{1,16}):([^:\s]{1,64})$/.exec(value);
  if (!match) return null;
  const createdAt = new Date(Number(match[1]));
  return Number.isFinite(createdAt.getTime()) ? { createdAt, id: match[2] } : null;
}

export interface UserNotificationDTO {
  id: string;
  kind: NotificationKind;
  type: UserNotificationType;
  /** Already in the viewer's language (any of the eight UI languages when the row is keyed, else Polish or English). */
  title: string;
  body: string;
  /** In-site path or https address; null when the notification has no (safe) link. */
  href: string | null;
  read: boolean;
  createdAt: string;
}

export interface UserNotificationPage {
  /** Mark-all cutoff for this page snapshot, so newer arrivals remain unread. */
  snapshotAt: string;
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
  // Browsers normalize controls and backslashes before resolving URLs. Reject encoded forms too,
  // including double-encoding, so downstream localization cannot turn a path into another origin.
  if (/[\u0000-\u0020\u007f\\]/.test(value) || /%(?:25)*(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(value)) return null;
  try {
    decodeURIComponent(value); // Reject malformed percent encodings.
    if (value.startsWith("/") && !value.startsWith("//")) return value;
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

/** `User.language` is any of eight codes; notifications exist in Polish and English only. */
export function notificationLanguage(language: string | null | undefined): "pl" | "en" {
  return language === "pl" ? "pl" : "en";
}
