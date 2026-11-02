import type { UserNotificationType } from "@/lib/modules/notifications";
import { BellIcon } from "../icons/MarkerBellIcons";
import { GiftIcon, HeartIcon, MegaphoneIcon, PlayBoxIcon, ReplyIcon, ClockIcon, ShieldIcon, SparkIcon, ThumbIcon } from "../icons/MarkerNotificationIcons";

const icons = { welcome: SparkIcon, support: GiftIcon, comment_reply: ReplyIcon, creator_like: HeartIcon, comment_like: ThumbIcon, new_video: PlayBoxIcon, premiere: ClockIcon, moderation: ShieldIcon, announcement: MegaphoneIcon, notification: BellIcon };

/** Decorative type icon (Marker pen 1.2px): a soft 36px disc with a quiet blue unread state. */
export function NotificationIcon({ type, unread = false }: { type?: UserNotificationType; unread?: boolean }) {
  const Icon = type && type in icons ? icons[type] : BellIcon;
  return (
    <span
      aria-hidden="true"
      data-notification-type={type ?? "notification"}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${unread ? "bg-[var(--chan-blue-soft)] text-[var(--chan-blue)]" : "bg-[var(--chan-surface)] text-[var(--chan-muted)]"}`}
    >
      <Icon size={18} />
    </span>
  );
}
