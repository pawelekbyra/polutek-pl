"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Heart } from "lucide-react";
import { NotificationDTO, NotificationKind } from "../../types/notification";

interface NotificationsMenuProps {
  notifications: NotificationDTO[];
  language: string;
  messagesLabel: string;
}

const KIND_ICON: Record<NotificationKind, React.ComponentType<{ size?: number; className?: string }>> = {
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

export default function NotificationsMenu({ notifications, language, messagesLabel }: NotificationsMenuProps) {
  const isPl = language === "pl";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(notifications);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setItems(notifications);
  }, [notifications]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const markAsRead = (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, read: true }),
    }).catch((err) => console.error("Failed to mark notification as read:", err));
  };

  const handleSelect = (n: NotificationDTO) => {
    markAsRead(n.id);
    setOpen(false);
    if (n.href) router.push(n.href);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="group relative flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[var(--chan-ink)] transition-transform duration-160 hover:-translate-y-px active:scale-95"
        aria-label={messagesLabel}
        title={messagesLabel}
      >
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[var(--chan-surface)] transition-colors duration-160 group-hover:bg-[var(--chan-line)]">
          <Bell size={22} className="shrink-0" strokeWidth={1.8} />
        </span>
        {unreadCount > 0 && (
          <span className="absolute right-0 top-0 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-red-600 px-1 text-[8px] font-bold leading-none text-white shadow-[0_0_0_2px_var(--chan-nav)]">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="fixed inset-x-3 top-[56px] z-[1100] overflow-hidden rounded-2xl border border-[var(--chan-line)] bg-white font-sans text-[var(--chan-ink)] shadow-[0_20px_50px_rgba(23,23,23,0.14)] sm:absolute sm:inset-x-auto sm:top-[calc(100%+8px)] sm:right-0 sm:w-[340px]"
        >
          <div className="flex items-center justify-between border-b border-[var(--chan-line)] px-4 py-3">
            <p className="text-[14px] font-bold">{isPl ? "Powiadomienia" : "Notifications"}</p>
            {unreadCount > 0 && (
              <span className="rounded-full bg-[#EFF3FE] px-2 py-[2px] text-[11px] font-bold text-[#2563EB]">
                {isPl ? `${unreadCount} nowe` : `${unreadCount} new`}
              </span>
            )}
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-[13px] text-[var(--chan-muted)]">
                {isPl ? "Brak powiadomień" : "No notifications yet"}
              </p>
            </div>
          ) : (
            <ul className="max-h-[360px] overflow-y-auto py-1">
              {items.map((n) => {
                const Icon = KIND_ICON[n.kind];
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleSelect(n)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--chan-surface)]"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EFF3FE] text-[#2563EB]">
                        <Icon size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-[6px]">
                          <span className="truncate text-[13px] font-bold">
                            {isPl ? n.titlePl : n.titleEn}
                          </span>
                          {!n.read && <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#2563EB]" />}
                        </span>
                        <span className="mt-[2px] block text-[12px] leading-snug text-[var(--chan-body)] line-clamp-2">
                          {isPl ? n.bodyPl : n.bodyEn}
                        </span>
                        <span className="mt-1 block text-[11px] text-[var(--chan-muted)]">
                          {formatRelativeTime(n.createdAt, isPl)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
