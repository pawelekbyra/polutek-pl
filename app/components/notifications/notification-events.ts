/** The bell polls its count once a minute; anything that just created a notification for the viewer says so here. */
export const NOTIFICATIONS_CHANGED_EVENT = "polutek:notifications-changed";

export function announceNotificationsChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "2 minuty temu" / "2 minutes ago" in the viewer's language; older than a week falls back to the date. */
export function formatNotificationAge(createdAt: string, locale: string, now = Date.now()): string {
  const then = new Date(createdAt).getTime();
  if (Number.isNaN(then)) return "";
  const age = Math.max(0, now - then);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (age < MINUTE) return rtf.format(0, "second");
  if (age < HOUR) return rtf.format(-Math.floor(age / MINUTE), "minute");
  if (age < DAY) return rtf.format(-Math.floor(age / HOUR), "hour");
  if (age < 7 * DAY) return rtf.format(-Math.floor(age / DAY), "day");
  return new Date(then).toLocaleDateString(locale, { dateStyle: "medium" });
}
