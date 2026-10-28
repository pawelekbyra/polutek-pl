import { Bell, Clock3, Heart, Megaphone, MessageCircle, Play, ShieldAlert, Sparkles, ThumbsUp, Gift } from "lucide-react";
import type { UserNotificationType } from "@/lib/modules/notifications";

const icons = { welcome: Sparkles, support: Gift, comment_reply: MessageCircle, creator_like: Heart, comment_like: ThumbsUp, new_video: Play, premiere: Clock3, moderation: ShieldAlert, announcement: Megaphone, notification: Bell };

export function NotificationIcon({ type }: { type?: UserNotificationType }) {
  const Icon = type && type in icons ? icons[type] : Bell;
  return <span aria-hidden="true" className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--chan-blue-soft)] text-[var(--chan-ink)]"><Icon className="h-5 w-5" strokeWidth={2} /></span>;
}
