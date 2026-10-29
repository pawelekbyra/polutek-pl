import type { UserNotificationDTO, UserNotificationPage } from "@/lib/modules/notifications";

export const NOTIFICATION_REQUEST_TIMEOUT_MS = 15_000;

/** A stalled request must release loading/writing state, including when a connection never returns headers. */
export async function notificationRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetch(url, { cache: "no-store", ...options, signal: controller.signal });
        if (!response.ok) throw new Error(`Notification request failed (${response.status})`);
        return await response.json() as T;
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error("Notification request timed out")); }, NOTIFICATION_REQUEST_TIMEOUT_MS);
      }),
    ]);
  } finally { clearTimeout(timer); }
}

export function notificationPage(value: UserNotificationPage): UserNotificationPage {
  if (!value || !Array.isArray(value.items) || !Number.isInteger(value.unreadCount) || value.unreadCount < 0 ||
      !(value.nextCursor === null || typeof value.nextCursor === "string") || typeof value.snapshotAt !== "string" || !Number.isFinite(Date.parse(value.snapshotAt))) {
    throw new Error("Invalid notification page");
  }
  for (const item of value.items) {
    if (!item || typeof item.id !== "string" || typeof item.title !== "string" || typeof item.body !== "string" || typeof item.read !== "boolean" ||
      !(item.href === null || typeof item.href === "string") || !Number.isFinite(Date.parse(item.createdAt))) throw new Error("Invalid notification");
  }
  return value;
}

export function newestFirst(a: UserNotificationDTO, b: UserNotificationDTO): number {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id);
}

export function mergeNotifications(current: UserNotificationDTO[], incoming: UserNotificationDTO[]): UserNotificationDTO[] {
  const items = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => items.set(item.id, item));
  return [...items.values()].sort(newestFirst);
}
