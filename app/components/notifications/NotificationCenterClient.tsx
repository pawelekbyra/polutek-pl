"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/react";
import { localizedPathFromLegacyPath } from "@/lib/i18n/routing";
import { useLanguage } from "../LanguageContext";
import { BellIcon } from "../icons/MarkerBellIcons";
import { useNotificationFeed, type NotificationFilter } from "./useNotificationFeed";
import { NotificationActions, NotificationSections, NotificationTabs } from "./NotificationParts";
import { navigateNotification } from "./notification-navigation";
import { NOTIFICATION_SETTINGS_EVENT } from "./notification-events";
import styles from "./notification-panel.module.css";

function resolveHref(href: string | null, language: Parameters<typeof localizedPathFromLegacyPath>[1]) {
  if (href === null) return { href: null, external: false };
  try {
    if (/^https:/i.test(href)) {
      const url = new URL(href);
      const origin = typeof window === "undefined" ? null : window.location.origin;
      if (!origin || url.origin !== origin) return { href, external: true };
      href = `${url.pathname}${url.search}${url.hash}`;
    }
    const hashAt = href.indexOf("#");
    const hash = hashAt >= 0 ? href.slice(hashAt) : "";
    const [path, ...query] = (hashAt >= 0 ? href.slice(0, hashAt) : href).split("?");
    const localized = localizedPathFromLegacyPath(path ?? href, language) ?? path ?? href;
    return { href: `${query.length > 0 ? `${localized}?${query.join("?")}` : localized}${hash}`, external: false };
  } catch { return { href: null, external: false }; }
}

/** Full-page inbox; it shares the bell feed's API, read state, polling, and deep-link behavior. */
export default function NotificationCenterClient() {
  const { userId } = useAuth();
  const { language, tx } = useLanguage();
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [now, setNow] = useState(() => Date.now());
  const feed = useNotificationFeed(true, language, filter, userId, 20);
  const [announcement, setAnnouncement] = useState("");
  const knownUnread = useRef<number | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!feed.countReady) return;
    const previous = knownUnread.current;
    knownUnread.current = feed.unread;
    if (previous !== null && feed.unread > previous) setAnnouncement(tx("Nowe powiadomienia: {0}", "New notifications: {0}", feed.unread));
  }, [feed.unread, feed.countReady, tx]);

  const followNotification = (event: MouseEvent, href: string, external: boolean) => {
    if (external || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    requestAnimationFrame(() => navigateNotification(href, router));
  };
  const changeRead = (id: string, read: boolean) => {
    const active = document.activeElement;
    void feed.markRead(id, read).then(() => requestAnimationFrame(() => {
      if (active && !active.isConnected) titleRef.current?.focus({ preventScroll: true });
    }));
  };
  const retry = (action: () => void) => <button type="button" className={styles.retry} onClick={action}>{tx("Spróbuj ponownie", "Try again")}</button>;

  return (
    <>
    <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</span>
    <section className={styles.center} aria-labelledby="notification-center-title" aria-busy={feed.status === "loading"}>
      <header className={`${styles.head} ${styles.centerHead}`}>
        <h1 id="notification-center-title" ref={titleRef} tabIndex={-1} className={styles.title}>{tx("Powiadomienia", "Notifications")}</h1>
        <NotificationActions tx={tx} refreshing={feed.refreshing} disabled={feed.refreshing || feed.writing || feed.status === "loading"} onRefresh={() => void feed.refresh()} onSettings={() => window.dispatchEvent(new CustomEvent(NOTIFICATION_SETTINGS_EVENT))} />
      </header>
      <NotificationTabs tx={tx} filter={filter} onFilter={setFilter} showMarkAll={feed.unread > 0} markAllDisabled={feed.writing || feed.status !== "idle"} onMarkAll={() => void feed.markRead().then(() => requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true })))} />
      {feed.hasNew && <button type="button" className={styles.newItems} disabled={feed.refreshing || feed.writing} onClick={() => { void feed.showNew().then((shown) => { if (shown) requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0; titleRef.current?.focus({ preventScroll: true }); }); }); }}>
        {feed.refreshing ? tx("Ładowanie…", "Loading…") : tx("Pokaż nowe powiadomienia", "Show new notifications")}
      </button>}
      <div ref={scrollRef} className={`${styles.scroll} ${styles.centerScroll}`}>
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
        {feed.nextCursor && !feed.moreError && <button type="button" className={styles.more} disabled={feed.loadingMore || feed.writing} onClick={() => void feed.loadMore()}>
          {feed.loadingMore ? tx("Ładowanie…", "Loading…") : tx("Pokaż starsze", "Show older")}
        </button>}
      </div>
    </section>
    </>
  );
}
