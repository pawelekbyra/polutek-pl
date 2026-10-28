"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useNotificationFeed } from "./useNotificationFeed";
import { NotificationIcon } from "./NotificationIcon";
import { navigateNotification } from "./notification-navigation";
import { BellIcon } from "../icons/MarkerBellIcons";
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
import { formatNotificationAge } from "./notification-events";

/** In-site paths are stored language-neutral (`/watch/<slug>`); https links are used as they are. */
function resolveHref(href: string | null, language: Parameters<typeof localizedPathFromLegacyPath>[1]) {
  if (href === null) return { href: null, external: false };
  if (/^https:/i.test(href)) {
    const url = new URL(href);
    if (url.origin !== window.location.origin) return { href, external: true };
    href = `${url.pathname}${url.search}${url.hash}`;
  }
  // The anchor (#comment-...) is carried through untouched; the rest is localized as before.
  const hashAt = href.indexOf("#");
  const hash = hashAt >= 0 ? href.slice(hashAt) : "";
  const [path, ...query] = (hashAt >= 0 ? href.slice(0, hashAt) : href).split("?");
  const localized = localizedPathFromLegacyPath(path ?? href, language) ?? path ?? href;
  return { href: `${query.length > 0 ? `${localized}?${query.join("?")}` : localized}${hash}`, external: false };
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
  const { items, unread, countReady, nextCursor, status, loadingMore, writing, writeError, refresh, loadMore, markRead } = useNotificationFeed(open, language);
  const [announcement, setAnnouncement] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const knownUnread = useRef<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!countReady) return;
    const previous = knownUnread.current;
    knownUnread.current = unread;
    if (previous !== null && unread > previous) setAnnouncement(tx("Nowe powiadomienia: {0}", "New notifications: {0}", unread));
  }, [unread, countReady, tx]);

  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [open]);

  const followNotification = (event: MouseEvent, href: string, external: boolean) => {
    if (external || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setOpen(false);
    // Let the menu return focus before the destination takes it.
    requestAnimationFrame(() => navigateNotification(href, router));
  };

  const label =
    unread > 0
      ? tx("Powiadomienia, nieprzeczytane: {0}", "Notifications, {0} unread", unread)
      : tx("Powiadomienia", "Notifications");
  const badge = unread > 99 ? "99+" : String(unread);
  const itemClassName =
    "flex min-h-14 w-full items-start gap-3 rounded-xl px-3 py-3 text-left text-[13px] text-[var(--chan-ink)] transition-colors hover:bg-[var(--chan-surface)] focus:bg-[var(--chan-surface)] focus:text-[var(--chan-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--chan-focus-ring)] active:bg-[var(--chan-line)] motion-reduce:transition-none";
  const actionClassName =
    "min-h-11 justify-center rounded-xl px-3 py-2 text-[13px] font-semibold text-[var(--chan-muted)] hover:text-[var(--chan-ink)] focus:bg-[var(--chan-surface)] focus:text-[var(--chan-ink)]";

  return (
    <>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </span>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          aria-label={label}
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--chan-ink)] transition-[transform,background-color,box-shadow] duration-160 hover:-translate-y-px hover:bg-[var(--chan-surface)] hover:shadow-[0_4px_12px_rgba(23,23,23,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] active:scale-95 motion-reduce:transform-none motion-reduce:transition-none"
        >
          <BellIcon size={24} className="shrink-0" />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-0 top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--chan-blue)] px-1 text-[10px] font-bold leading-none text-white"
            >
              {badge}
            </span>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          // Negative offset: the panel laps over the bottom edge of the top bar by a few px (it starts inside the bar's lower padding)
          // instead of hanging clear below it (owner 2026-10-28).
          sideOffset={-3}
          // Above the sticky top bar (z-[1000]): the positioner is the stacking context, so the z-index goes on it.
          positionerClassName="z-[1100]"
          aria-label={tx("Powiadomienia", "Notifications")}
          aria-busy={status === "loading" || loadingMore}
          className="z-[1100] max-h-[min(70dvh,600px)] w-[min(22rem,calc(100vw-1rem))] overflow-y-auto rounded-2xl border border-[var(--chan-line)] bg-[var(--chan-card)] p-2 font-sans text-[var(--chan-ink)] shadow-[0_24px_60px_-18px_rgba(15,23,42,0.28)] ring-0"
        >
          <div className="flex min-h-11 items-center justify-between gap-3 px-3 pb-0.5">
            <DropdownMenuLabel className="p-0">
              <span className="text-[15px] font-bold text-[var(--chan-ink)]">{tx("Powiadomienia", "Notifications")}</span>
            </DropdownMenuLabel>
            {unread > 0 && status === "idle" && (
              <DropdownMenuItem
                closeOnClick={false}
                disabled={writing}
                onClick={() => markRead()}
                className="min-h-11 max-w-[55%] shrink-0 cursor-pointer rounded-lg px-2 text-right text-[12px] leading-tight font-semibold text-[var(--chan-blue)] hover:bg-[var(--chan-blue-soft)] focus:bg-[var(--chan-blue-soft)] focus:text-[var(--chan-blue)]"
              >
                {tx("Oznacz wszystkie jako przeczytane", "Mark all as read")}
              </DropdownMenuItem>
            )}
          </div>
          <DropdownMenuSeparator className="mx-2 my-1 bg-[var(--chan-line)]" />

          {status === "loading" && items.length === 0 && (
            <div role="status" aria-label={tx("Ładowanie…", "Loading…")} className="flex flex-col gap-1">
              {[0, 1, 2].map((i) => (
                <div key={i} aria-hidden="true" className="flex items-start gap-3 px-3 py-3">
                  <span className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-[var(--chan-surface)] motion-reduce:animate-none" />
                  <span className="flex flex-1 flex-col gap-2 pt-1">
                    <span className="h-3 w-4/5 animate-pulse rounded bg-[var(--chan-surface)] motion-reduce:animate-none" />
                    <span className="h-3 w-3/5 animate-pulse rounded bg-[var(--chan-surface)] motion-reduce:animate-none" />
                  </span>
                </div>
              ))}
            </div>
          )}
          {status === "error" && (
            <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
              <p role="alert" className="text-[13px] text-[var(--chan-ink)]">{tx("Nie udało się wczytać powiadomień.", "Could not load notifications.")}</p>
              <DropdownMenuItem closeOnClick={false} onClick={() => void refresh()} className="min-h-11 cursor-pointer justify-center rounded-full bg-[var(--chan-blue-soft)] px-4 text-[13px] font-semibold text-[var(--chan-blue)] focus:bg-[var(--chan-blue-soft)] focus:text-[var(--chan-blue)]">
                {tx("Spróbuj ponownie", "Try again")}
              </DropdownMenuItem>
            </div>
          )}
          {status === "idle" && items.length === 0 && (
            <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
              <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--chan-surface)] text-[var(--chan-muted)]"><BellIcon size={28} /></span>
              <p className="text-[14px] font-semibold text-[var(--chan-ink)]">{tx("Brak powiadomień.", "No notifications.")}</p>
              <p className="max-w-[16rem] text-[12px] text-[var(--chan-muted)]">{tx("Gdy ktoś odpowie na Twój komentarz albo pojawi się nowy film, zobaczysz to tutaj.", "When someone replies to your comment or a new video appears, you will see it here.")}</p>
            </div>
          )}

          {items.map((n) => {
            const link = resolveHref(n.href, language);
            const content = (
              <>
                <NotificationIcon type={n.type} unread={!n.read} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className={`line-clamp-2 [overflow-wrap:anywhere] text-[14px] leading-snug ${n.read ? "font-medium" : "font-bold"}`}>
                    {n.title}
                    {!n.read && <span className="sr-only"> ({tx("nieprzeczytane", "unread")})</span>}
                  </span>
                  {n.body && <span className="line-clamp-2 [overflow-wrap:anywhere] text-[12px] leading-snug text-[var(--chan-muted)]">{n.body}</span>}
                  <time dateTime={n.createdAt} title={new Date(n.createdAt).toLocaleString(language, { dateStyle: "medium", timeStyle: "short" })} className={`text-[11px] ${n.read ? "text-[var(--chan-muted)]" : "font-semibold text-[var(--chan-blue)]"}`}>
                    {formatNotificationAge(n.createdAt, language, now)}
                  </time>
                </span>
                {!n.read && <span aria-hidden="true" className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--chan-blue)]" />}
              </>
            );
            return link.href ? (
              <DropdownMenuItem
                key={n.id}
                onClick={(event) => { markRead(n.id); followNotification(event, link.href!, link.external); }}
                render={<a href={link.href} {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} />}
                className={`${itemClassName} ${n.read ? "" : "bg-[var(--chan-blue)]/[0.07]"}`}
              >
                {content}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem key={n.id} onClick={() => markRead(n.id)} className={`${itemClassName} ${n.read ? "" : "bg-[var(--chan-blue)]/[0.07]"}`}>
                {content}
              </DropdownMenuItem>
            );
          })}

          {writeError && <p role="alert" className="px-3 py-2 text-[13px] text-[var(--chan-ink)]">{tx("Nie udało się zapisać odczytu powiadomień. Spróbuj ponownie.", "Could not save read notifications. Please try again.")}</p>}
          {nextCursor && <DropdownMenuSeparator className="mx-2 my-1 bg-[var(--chan-line)]" />}
          {nextCursor && (
            <DropdownMenuItem closeOnClick={false} disabled={loadingMore || writing} onClick={() => void loadMore()} className={actionClassName}>
              {loadingMore ? tx("Ładowanie…", "Loading…") : tx("Pokaż starsze", "Show older")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
