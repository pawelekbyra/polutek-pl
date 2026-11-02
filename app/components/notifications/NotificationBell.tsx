"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Popover } from "@base-ui/react/popover";
import { Drawer } from "@base-ui/react/drawer";
import { CloseButton } from "@/components/ui/close-button";
import { useAuth } from "@/lib/auth/react";
import { useNotificationFeed, type NotificationFilter } from "./useNotificationFeed";
import { NotificationActions, NotificationSections, NotificationTabs } from "./NotificationParts";
import { navigateNotification } from "./notification-navigation";
import { BellIcon } from "../icons/MarkerBellIcons";
import { getLocalizedHref, localizedPathFromLegacyPath } from "@/lib/i18n/routing";
import { useLanguage } from "../LanguageContext";
import { NOTIFICATION_SETTINGS_EVENT } from "./notification-events";
import { NotificationSheet } from "./NotificationSheet";
import { useIsNotificationSheet, useSheetHistory } from "./use-notification-sheet";
import styles from "./notification-panel.module.css";

/** In-site paths are stored language-neutral; absolute same-origin URLs use client navigation too. */
function resolveHref(href: string | null, language: Parameters<typeof localizedPathFromLegacyPath>[1]) {
  if (href === null) return { href: null, external: false };
  try {
    if (/^https:/i.test(href)) {
      const url = new URL(href);
      if (url.origin !== window.location.origin) return { href, external: true };
      href = `${url.pathname}${url.search}${url.hash}`;
    }
    const hashAt = href.indexOf("#");
    const hash = hashAt >= 0 ? href.slice(hashAt) : "";
    const [path, ...query] = (hashAt >= 0 ? href.slice(0, hashAt) : href).split("?");
    const localized = localizedPathFromLegacyPath(path ?? href, language) ?? path ?? href;
    return { href: `${query.length > 0 ? `${localized}?${query.join("?")}` : localized}${hash}`, external: false };
  } catch { return { href: null, external: false }; }
}

/** An anchored dialog (popover from 768 px up, bottom sheet below) with a real list: opening it never marks messages read or steals the reading position. */
export default function NotificationBell() {
  const { userId } = useAuth();
  return <NotificationBellForAccount key={userId ?? "signed-out"} accountId={userId} />;
}

function NotificationBellForAccount({ accountId }: { accountId: string | null }) {
  const { language, tx } = useLanguage();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const feed = useNotificationFeed(open, language, filter, accountId, 5);
  const [announcement, setAnnouncement] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const knownUnread = useRef<number | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const isSheet = useIsNotificationSheet();
  const afterClose = useRef<(() => void) | null>(null);
  // Switching popover <-> sheet while open (phone rotation) remounts the panel without a slide.
  const [lastIsSheet, setLastIsSheet] = useState(isSheet);
  const [instant, setInstant] = useState(false);
  if (lastIsSheet !== isSheet) { setLastIsSheet(isSheet); setInstant(open); }
  useEffect(() => { if (!open) setInstant(false); }, [open]);
  useSheetHistory(open && isSheet, () => setOpen(false));
  const flushAfterClose = () => { const action = afterClose.current; afterClose.current = null; action?.(); };
  useEffect(() => { if (!isSheet) flushAfterClose(); }, [isSheet]);
  /** Closes the panel and runs `action` once it is gone (the sheet's scroll lock must be released before the page moves). */
  const runAfterClose = (action: () => void) => {
    if (isSheet && open) { afterClose.current = action; setOpen(false); return; }
    setOpen(false);
    requestAnimationFrame(action);
  };

  useEffect(() => {
    if (!feed.countReady) return;
    const previous = knownUnread.current;
    knownUnread.current = feed.unread;
    if (previous !== null && feed.unread > previous) setAnnouncement(tx("Nowe powiadomienia: {0}", "New notifications: {0}", feed.unread));
  }, [feed.unread, feed.countReady, tx]);
  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [open]);

  const followNotification = (event: MouseEvent, href: string, external: boolean) => {
    if (external || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    runAfterClose(() => navigateNotification(href, router));
  };
  const changeRead = (id: string, read: boolean) => {
    const active = document.activeElement;
    void feed.markRead(id, read).then(() => requestAnimationFrame(() => {
      if (active && !active.isConnected && open) titleRef.current?.focus({ preventScroll: true });
    }));
  };
  const openSettings = () => {
    runAfterClose(() => window.dispatchEvent(new CustomEvent(NOTIFICATION_SETTINGS_EVENT)));
  };
  const label = feed.unread > 0
    ? tx("Powiadomienia, nieprzeczytane: {0}", "Notifications, {0} unread", feed.unread)
    : tx("Powiadomienia", "Notifications");
  const badge = feed.unread > 99 ? "99+" : String(feed.unread);
  const retry = (action: () => void) => <button type="button" className={styles.retry} onClick={action}>{tx("Spróbuj ponownie", "Try again")}</button>;

  const Title = (isSheet ? Drawer.Title : Popover.Title) as typeof Popover.Title;
  const Close = (isSheet ? Drawer.Close : Popover.Close) as typeof Popover.Close;
  const Trigger = (isSheet ? Drawer.Trigger : Popover.Trigger) as typeof Popover.Trigger;
  const trigger = (
    <Trigger aria-label={label} className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--chan-ink)] transition-[transform,background-color,box-shadow] duration-160 hover:-translate-y-px hover:bg-[var(--chan-surface)] hover:shadow-[0_4px_12px_rgba(23,23,23,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--chan-blue)] active:scale-95 motion-reduce:transform-none motion-reduce:transition-none">
        <BellIcon size={24} strokeWidth={1.5} className="shrink-0 text-[var(--chan-ink)]" />
        {feed.unread > 0 && <span aria-hidden="true" className="absolute right-0 top-0 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--chan-blue)] px-1 text-[10px] font-bold leading-none text-white">{badge}</span>}
    </Trigger>
  );
  const header = (
    <div className={styles.head}>
      <Title ref={titleRef} tabIndex={-1} className={styles.title}>{tx("Powiadomienia", "Notifications")}</Title>
      <NotificationActions tx={tx} refreshing={feed.refreshing} disabled={feed.refreshing || feed.writing || feed.status === "loading"} onRefresh={() => void feed.refresh()} onSettings={openSettings} />
    </div>
  );
  const closeButton = <Close aria-label={tx("Zamknij", "Close")} render={<CloseButton className={isSheet ? "top-2" : undefined} />} />;
  const panelBody = <>
            <NotificationTabs tx={tx} filter={filter} onFilter={setFilter} showMarkAll={feed.unread > 0} markAllDisabled={feed.writing || feed.status !== "idle"} onMarkAll={() => { void feed.markRead().then(() => requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true }))); }} />
            {feed.hasNew && <button type="button" className={styles.newItems} disabled={feed.refreshing || feed.writing} onClick={() => { void feed.showNew().then((shown) => { if (shown) requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; titleRef.current?.focus({ preventScroll: true }); }); }); }}>
              {feed.refreshing ? tx("Ładowanie…", "Loading…") : tx("Pokaż nowe powiadomienia", "Show new notifications")}
            </button>}
            <div ref={scrollRef} className={styles.scroll}>
              {feed.status === "loading" && !feed.items.length && <div role="status" aria-label={tx("Ładowanie…", "Loading…")}>
                {[0, 1, 2].map((i) => <div key={i} aria-hidden="true" className={styles.skeleton}><span className={styles.skeletonCircle} /><span className={styles.skeletonText}><span /><span /></span></div>)}
              </div>}
              {feed.status === "error" && <div className={styles.message}><p role="alert">{tx("Nie udało się wczytać powiadomień.", "Could not load notifications.")}</p>{retry(() => void feed.refresh())}</div>}
              {feed.status === "idle" && !feed.items.length && <div className={styles.empty}>
                <span aria-hidden="true" className={styles.emptyIcon}><BellIcon size={26} /></span>
                <p className={styles.emptyTitle}>{filter === "unread" ? tx("Wszystko przeczytane", "All caught up") : tx("Brak powiadomień.", "No notifications.")}</p>
                <p className={styles.emptyHint}>{filter === "unread" ? tx("Nowe wiadomości pojawią się tutaj.", "New messages will appear here.") : tx("Gdy ktoś odpowie na Twój komentarz albo pojawi się nowy film, zobaczysz to tutaj.", "When someone replies to your comment or a new video appears, you will see it here.")}</p>
              </div>}
              <NotificationSections tx={tx} language={language} now={now} pending={feed.writing} filter={filter} items={feed.items} resolve={(href) => resolveHref(href, language)} onRead={changeRead} onFollow={followNotification} />
              {feed.refreshError && <div className={styles.message}><p role="alert">{tx("Nie udało się odświeżyć powiadomień. Zachowaliśmy poprzednie wiadomości.", "Could not refresh notifications. Your previous messages are still here.")}</p>{retry(() => void feed.refresh())}</div>}
              {feed.writeError && <div className={styles.message}><p role="alert">{tx("Nie udało się zapisać odczytu powiadomień. Spróbuj ponownie.", "Could not save read notifications. Please try again.")}</p>{retry(() => void feed.retryWrite())}</div>}
              {feed.moreError && <div className={styles.message}><p role="alert">{tx("Nie udało się wczytać starszych powiadomień.", "Could not load older notifications.")}</p>{retry(() => void feed.loadMore())}</div>}
            </div>
            <div className={styles.footer}>
              <a href={getLocalizedHref(language, "notifications")} className={styles.viewAll} onClick={(event) => followNotification(event, getLocalizedHref(language, "notifications"), false)}>{tx("Zobacz wszystkie", "See all")}</a>
            </div>
  </>;

  return <>
    <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</span>
    {isSheet ? (
      <NotificationSheet open={open} onOpenChange={setOpen} onOpenChangeComplete={(next) => { if (!next) flushAfterClose(); }} trigger={trigger} initialFocus={titleRef} busy={feed.status === "loading"} instant={instant}
        hint={tx("Przeciągnij uchwyt w dół albo użyj przycisku Zamknij, aby zamknąć panel.", "Drag the handle down or use the Close button to dismiss the panel.")}>
        {closeButton}
        <div className={styles.sheetDrag}>
          <span aria-hidden="true" className={styles.grabber} />
          {header}
        </div>
        {panelBody}
      </NotificationSheet>
    ) : (
      <Popover.Root open={open} onOpenChange={setOpen} modal="trap-focus">
        {trigger}
        <Popover.Portal>
          <Popover.Positioner align="end" sideOffset={-3} className={styles.positioner}>
            <Popover.Popup role="dialog" className={styles.panel} data-instant={instant ? "" : undefined} initialFocus={titleRef} aria-busy={feed.status === "loading"}>
              {closeButton}
              {header}
              {panelBody}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    )}
  </>;
}
