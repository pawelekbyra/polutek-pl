"use client";

import { useMemo, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { Bell, Heart } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  NotificationDTO,
  NotificationKind,
} from "../../types/notification";
import { cn } from "@/lib/utils";

interface NotificationsMenuProps {
  notifications: NotificationDTO[];
  language: string;
  messagesLabel: string;
}

const KIND_ICON: Record<
  NotificationKind,
  ComponentType<{ size?: number; className?: string }>
> = {
  welcome: Bell,
  system: Bell,
  comment: Bell,
  support: Heart,
  patron: Heart,
};

function formatRelativeTime(iso: string, isPl: boolean): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return isPl ? "przed chwilą" : "just now";
  if (minutes < 60) return isPl ? `${minutes} min temu` : `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return isPl ? `${hours} godz. temu` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  return isPl ? `${days} dni temu` : `${days}d ago`;
}

export default function NotificationsMenu({
  notifications,
  language,
  messagesLabel,
}: NotificationsMenuProps) {
  const isPl = language === "pl";
  const router = useRouter();
  const [locallyReadIds, setLocallyReadIds] = useState<Set<string>>(
    () => new Set(),
  );
  const items = useMemo(
    () =>
      notifications.map((notification) =>
        locallyReadIds.has(notification.id)
          ? { ...notification, read: true }
          : notification,
      ),
    [locallyReadIds, notifications],
  );
  const unreadCount = useMemo(
    () => items.filter((notification) => !notification.read).length,
    [items],
  );

  const markAsRead = (id: string) => {
    setLocallyReadIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
    void fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, read: true }),
    }).catch((error) =>
      console.error("Failed to mark notification as read:", error),
    );
  };

  const handleSelect = (notification: NotificationDTO) => {
    markAsRead(notification.id);
    if (notification.href) router.push(notification.href);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="group relative flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[var(--chan-ink)] transition-transform duration-160 hover:-translate-y-px active:scale-95 motion-reduce:transform-none motion-reduce:transition-none"
        aria-label={messagesLabel}
        title={messagesLabel}
      >
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[var(--chan-surface)] transition-colors duration-160 group-hover:bg-[var(--chan-line)] motion-reduce:transition-none">
          <Bell aria-hidden="true" size={22} className="shrink-0" strokeWidth={1.8} />
        </span>
        {unreadCount > 0 && (
          <span className="absolute right-0 top-0 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-red-600 px-1 text-[8px] font-bold leading-none text-white shadow-[0_0_0_2px_var(--chan-nav)]">
            {unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="z-[1100] w-[min(340px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-card)] p-0 font-sans text-[var(--chan-ink)] shadow-[0_20px_50px_rgba(15,23,42,0.14)] ring-0"
      >
        <DropdownMenuLabel className="flex items-center justify-between px-4 py-3">
          <span className="text-[14px] font-bold text-[var(--chan-ink)]">
            {isPl ? "Powiadomienia" : "Notifications"}
          </span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-[var(--chan-blue-soft)] px-2 py-[2px] text-[11px] font-bold text-[var(--chan-blue)]">
              {isPl ? `${unreadCount} nowe` : `${unreadCount} new`}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0 bg-[var(--chan-line)]" />

        {items.length === 0 ? (
          <DropdownMenuItem
            disabled
            className="min-h-20 justify-center px-4 py-8 text-center text-[13px] text-[var(--chan-muted)] opacity-100"
          >
            {isPl ? "Brak powiadomień" : "No notifications yet"}
          </DropdownMenuItem>
        ) : (
          <div className="max-h-[360px] overflow-y-auto py-1">
            {items.map((notification) => {
              const Icon = KIND_ICON[notification.kind];
              const isPatronNotification =
                notification.kind === "patron" || notification.kind === "support";

              return (
                <DropdownMenuItem
                  key={notification.id}
                  onClick={() => handleSelect(notification)}
                  className="items-start gap-3 rounded-none px-4 py-3 text-left focus:bg-[var(--chan-surface)] focus:text-[var(--chan-ink)]"
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                      isPatronNotification
                        ? "bg-[var(--chan-amber-soft)] text-[var(--chan-amber-strong)]"
                        : "bg-[var(--chan-blue-soft)] text-[var(--chan-blue)]",
                    )}
                  >
                    <Icon aria-hidden="true" size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-[6px]">
                      <span className="truncate text-[13px] font-bold">
                        {isPl ? notification.titlePl : notification.titleEn}
                      </span>
                      {!notification.read && (
                        <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[var(--chan-blue)]" />
                      )}
                    </span>
                    <span className="mt-[2px] line-clamp-2 block text-[12px] leading-snug text-[var(--chan-body)]">
                      {isPl ? notification.bodyPl : notification.bodyEn}
                    </span>
                    <span className="mt-1 block text-[11px] text-[var(--chan-muted)]">
                      {formatRelativeTime(notification.createdAt, isPl)}
                    </span>
                  </span>
                </DropdownMenuItem>
              );
            })}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
