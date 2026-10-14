"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { localizedPathFromLegacyPath } from "@/lib/i18n/routing";
import { useLanguage } from "../LanguageContext";

type BellItem = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  createdAt: string;
};

type BellPage = { items: BellItem[]; nextCursor: string | null; unreadCount: number };

const PAGE_SIZE = 10;
const POLL_MS = 60_000;

async function fetchPage(cursor?: string, signal?: AbortSignal): Promise<BellPage | null> {
  const query = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor) query.set("cursor", cursor);
  try {
    const response = await fetch(`/api/user/notifications?${query}`, { cache: "no-store", signal });
    return response.ok ? ((await response.json()) as BellPage) : null;
  } catch {
    return null;
  }
}

async function fetchUnreadCount(signal?: AbortSignal): Promise<number | null> {
  try {
    const response = await fetch("/api/user/notifications/unread-count", { cache: "no-store", signal });
    if (!response.ok) return null;
    const body = (await response.json()) as { unreadCount?: unknown };
    return typeof body.unreadCount === "number" ? body.unreadCount : null;
  } catch {
    return null;
  }
}

function postRead(body: { id: string } | { all: true }) {
  // keepalive: the request survives the navigation that clicking a notification link starts.
  return fetch("/api/user/notifications/read", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => undefined);
}

/** In-site paths are stored language-neutral (`/watch/<slug>`); https links are used as they are. */
function resolveHref(href: string | null, language: Parameters<typeof localizedPathFromLegacyPath>[1]) {
  if (href === null) return { href: null, external: false };
  if (/^https:/i.test(href)) return { href, external: true };
  const [path, ...query] = href.split("?");
  const localized = localizedPathFromLegacyPath(path ?? href, language) ?? path ?? href;
  return { href: query.length > 0 ? `${localized}?${query.join("?")}` : localized, external: false };
}

/**
 * Notification bell (signed-in viewers, next to the account menu): unread count badge, a menu with
 * the latest notifications, each a link to what it is about. Keyboard: the trigger opens the menu,
 * arrows move between items, Enter follows the link, Escape closes. The count is mirrored in the
 * trigger's accessible name and announced politely (`role="status"`) when it grows, not on first load.
 */
export default function NotificationBell() {
  const { language, tx } = useLanguage();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<BellItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [announcement, setAnnouncement] = useState("");
  const knownUnread = useRef<number | null>(null);

  const applyCount = useCallback(
    (count: number) => {
      setUnread(count);
      const previous = knownUnread.current;
      knownUnread.current = count;
      if (previous !== null && count > previous) {
        setAnnouncement(tx("Nowe powiadomienia: {0}", "New notifications: {0}", count));
      }
    },
    [tx],
  );

  const apply = useCallback(
    (page: BellPage, mode: "replace" | "append") => {
      setItems((current) =>
        mode === "append" ? [...current, ...page.items.filter((n) => !current.some((c) => c.id === n.id))] : page.items,
      );
      setNextCursor(page.nextCursor);
      applyCount(page.unreadCount);
    },
    [applyCount],
  );

  // The light poll: just the number, never the list.
  const pollCount = useCallback(
    async (signal?: AbortSignal) => {
      const count = await fetchUnreadCount(signal);
      if (signal?.aborted || count === null) return;
      applyCount(count);
    },
    [applyCount],
  );

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const page = await fetchPage(undefined, signal);
      if (signal?.aborted) return;
      if (!page) {
        setStatus("error");
        return;
      }
      setStatus("idle");
      apply(page, "replace");
    },
    [apply],
  );

  // Count on mount, then every minute while the tab is visible and again when it comes back.
  useEffect(() => {
    const controller = new AbortController();
    void pollCount(controller.signal);
    const tick = () => {
      if (document.visibilityState === "visible") void pollCount(controller.signal);
    };
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [pollCount]);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setStatus("loading");
      void refresh();
    }
  };

  const markRead = (id: string) => {
    const target = items.find((n) => n.id === id);
    setItems((current) => current.map((n) => (n.id === id ? { ...n, read: true } : n)));
    if (target && !target.read) {
      setUnread((count) => Math.max(0, count - 1));
      knownUnread.current = Math.max(0, (knownUnread.current ?? 1) - 1);
    }
    void postRead({ id });
  };

  const markAllRead = () => {
    setItems((current) => current.map((n) => ({ ...n, read: true })));
    setUnread(0);
    knownUnread.current = 0;
    void postRead({ all: true });
  };

  const loadMore = async () => {
    if (!nextCursor) return;
    const page = await fetchPage(nextCursor);
    if (page) apply(page, "append");
  };

  const label =
    unread > 0
      ? tx("Powiadomienia, nieprzeczytane: {0}", "Notifications, {0} unread", unread)
      : tx("Powiadomienia", "Notifications");
  const badge = unread > 99 ? "99+" : String(unread);
  const itemClassName =
    "flex min-h-11 w-full flex-col items-start gap-0.5 rounded-none px-3 py-2 text-left text-[13px] text-[var(--chan-ink)] focus:bg-[var(--chan-surface)] focus:text-[var(--chan-ink)]";
  const actionClassName =
    "min-h-10 rounded-none px-3 py-2 text-[13px] font-semibold text-[var(--chan-ink)] focus:bg-[var(--chan-surface)] focus:text-[var(--chan-ink)]";

  return (
    <>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </span>
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger
          aria-label={label}
          className="relative flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-none text-[var(--chan-ink)] transition-[transform,background-color,box-shadow] duration-160 hover:-translate-y-px hover:bg-[var(--chan-surface)] hover:shadow-[0_4px_12px_rgba(23,23,23,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] active:scale-95 motion-reduce:transform-none motion-reduce:transition-none"
        >
          <Bell className="h-5 w-5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-0 top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-none bg-[var(--chan-blue)] px-1 text-[10px] font-bold leading-none text-white"
            >
              {badge}
            </span>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="z-[1100] max-h-[70vh] w-[min(22rem,calc(100vw-1rem))] rounded-none border border-[var(--chan-line)] bg-[var(--chan-card)] p-1.5 font-sans text-[var(--chan-ink)] shadow-[0_20px_50px_rgba(15,23,42,0.14)] ring-0"
        >
          <DropdownMenuLabel className="px-3 py-2">
            <span className="text-[14px] font-bold text-[var(--chan-ink)]">{tx("Powiadomienia", "Notifications")}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="mx-1 bg-[var(--chan-line)]" />

          {status === "loading" && items.length === 0 && (
            <p className="px-3 py-4 text-[13px] text-[var(--chan-muted)]">{tx("Ładowanie…", "Loading…")}</p>
          )}
          {status === "error" && (
            <p role="alert" className="px-3 py-4 text-[13px] text-red-600">
              {tx("Nie udało się wczytać powiadomień.", "Could not load notifications.")}
            </p>
          )}
          {status === "idle" && items.length === 0 && (
            <p className="px-3 py-4 text-[13px] text-[var(--chan-muted)]">{tx("Brak powiadomień.", "No notifications.")}</p>
          )}

          {items.map((n) => {
            const link = resolveHref(n.href, language);
            const content = (
              <>
                <span className="flex w-full items-start gap-2">
                  {!n.read && (
                    <span aria-hidden="true" className="mt-1.5 h-2 w-2 shrink-0 rounded-none bg-[var(--chan-blue)]" />
                  )}
                  <span className={n.read ? "font-medium" : "font-bold"}>
                    {n.title}
                    {!n.read && <span className="sr-only"> ({tx("nieprzeczytane", "unread")})</span>}
                  </span>
                </span>
                {n.body && <span className="line-clamp-2 w-full text-[12px] text-[var(--chan-muted)]">{n.body}</span>}
                <time dateTime={n.createdAt} className="text-[11px] text-[var(--chan-muted)]">
                  {new Date(n.createdAt).toLocaleString(language, { dateStyle: "medium", timeStyle: "short" })}
                </time>
              </>
            );
            return link.href ? (
              <DropdownMenuItem
                key={n.id}
                onClick={() => markRead(n.id)}
                render={<a href={link.href} {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} />}
                className={itemClassName}
              >
                {content}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem key={n.id} onClick={() => markRead(n.id)} className={itemClassName}>
                {content}
              </DropdownMenuItem>
            );
          })}

          {(nextCursor || unread > 0) && <DropdownMenuSeparator className="mx-1 bg-[var(--chan-line)]" />}
          {nextCursor && (
            <DropdownMenuItem closeOnClick={false} onClick={() => void loadMore()} className={actionClassName}>
              {tx("Pokaż starsze", "Show older")}
            </DropdownMenuItem>
          )}
          {unread > 0 && (
            <DropdownMenuItem closeOnClick={false} onClick={markAllRead} className={actionClassName}>
              {tx("Oznacz wszystkie jako przeczytane", "Mark all as read")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
