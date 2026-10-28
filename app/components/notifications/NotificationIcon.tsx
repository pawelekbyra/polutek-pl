import type { UserNotificationType } from "@/lib/modules/notifications";
import { BellIcon } from "../icons/MarkerBellIcons";
import { GiftIcon, HeartIcon, MegaphoneIcon, PlayBoxIcon, ReplyIcon, ClockIcon, ShieldIcon, SparkIcon, ThumbIcon } from "../icons/MarkerNotificationIcons";

const icons = { welcome: SparkIcon, support: GiftIcon, comment_reply: ReplyIcon, creator_like: HeartIcon, comment_like: ThumbIcon, new_video: PlayBoxIcon, premiere: ClockIcon, moderation: ShieldIcon, announcement: MegaphoneIcon, notification: BellIcon };

/** Decorative type icon (set B, Marker pen 1.2px): a 40px soft disc, white with a blue pen and ring while the notification is unread, soft grey once read. */
export function NotificationIcon({ type, unread = false }: { type?: UserNotificationType; unread?: boolean }) {
  const Icon = type && type in icons ? icons[type] : BellIcon;
  return (
    <span
      aria-hidden="true"
      data-notification-type={type ?? "notification"}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${unread ? "bg-[var(--chan-card)] text-[var(--chan-blue)] ring-1 ring-[var(--chan-blue)]/25" : "bg-[var(--chan-surface)] text-[var(--chan-muted)]"}`}
    >
      <Icon size={20} />
    </span>
  );
}
