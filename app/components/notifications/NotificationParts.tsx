"use client";

import { useId, type ReactNode, type MouseEvent } from "react";
import type { Locale } from "@/lib/i18n/routing";
import type { Tx } from "@/lib/i18n/ui";
import type { UserNotificationDTO } from "@/lib/modules/notifications";
import { SettingsIcon, SubscribeCheckIcon } from "../icons/MarkerBellIcons";
import { RefreshIcon } from "../icons/MarkerUiIcons";
import type { NotificationFilter } from "./useNotificationFeed";
import { NotificationRow } from "./NotificationRow";
import styles from "./notification-panel.module.css";

type Link = { href: string | null; external: boolean };

/** Quiet icon-only actions (32 px, Marker pen, name + tooltip): refresh and settings, like the icon row of a social inbox. */
export function NotificationActions({ tx, refreshing, disabled, onRefresh, onSettings }: { tx: Tx; refreshing: boolean; disabled: boolean; onRefresh: () => void; onSettings: () => void }) {
  const refreshLabel = refreshing ? tx("Odświeżanie…", "Refreshing…") : tx("Odśwież", "Refresh");
  const settingsLabel = tx("Ustawienia powiadomień", "Notification settings");
  return (
    <div className={styles.actions}>
      <button type="button" className={`${styles.iconButton} ${refreshing ? styles.refreshing : ""}`} aria-label={refreshLabel} title={refreshLabel} aria-busy={refreshing} disabled={disabled} onClick={onRefresh}><RefreshIcon size={18} /></button>
      <button type="button" className={styles.iconButton} aria-label={settingsLabel} title={settingsLabel} onClick={onSettings}><SettingsIcon size={18} /></button>
    </div>
  );
}

/** Small pill tabs "All | Unread" and the mark-all-read icon on the right. */
export function NotificationTabs({ tx, filter, onFilter, showMarkAll, markAllDisabled, onMarkAll }: { tx: Tx; filter: NotificationFilter; onFilter: (filter: NotificationFilter) => void; showMarkAll: boolean; markAllDisabled: boolean; onMarkAll: () => void }) {
  const markAll = tx("Oznacz wszystkie jako przeczytane", "Mark all as read");
  return (
    <div className={styles.toolbar}>
      <div className={styles.filters} role="group" aria-label={tx("Filtr powiadomień", "Notification filter")}>
        <button type="button" className={styles.filter} aria-pressed={filter === "all"} onClick={() => onFilter("all")}>{tx("Wszystkie", "All")}</button>
        <button type="button" className={styles.filter} aria-pressed={filter === "unread"} onClick={() => onFilter("unread")}>{tx("Nieprzeczytane", "Unread")}</button>
      </div>
      {showMarkAll && <button type="button" className={styles.iconButton} aria-label={markAll} title={markAll} disabled={markAllDisabled} onClick={onMarkAll}><SubscribeCheckIcon size={18} /></button>}
    </div>
  );
}

type ListProps = {
  tx: Tx; language: Locale; now: number; pending: boolean; filter: NotificationFilter;
  items: UserNotificationDTO[];
  resolve: (href: string | null) => Link;
  onRead: (id: string, read: boolean) => void;
  onFollow: (event: MouseEvent, href: string, external: boolean) => void;
};

/** "New" (unread) and "Earlier" (read) sections; the unread filter shows one flat list without headings. */
export function NotificationSections({ tx, language, now, pending, filter, items, resolve, onRead, onFollow }: ListProps) {
  const uid = useId();
  if (items.length === 0) return null;
  const rows = (list: UserNotificationDTO[], label: string): ReactNode => (
    <ul className={styles.list} aria-label={label}>
      {list.map((item) => <NotificationRow key={item.id} item={item} link={resolve(item.href)} language={language} tx={tx} now={now} pending={pending} onRead={(read) => onRead(item.id, read)} onFollow={onFollow} />)}
    </ul>
  );
  const listLabel = tx("Lista powiadomień", "Notification list");
  if (filter === "unread") return <>{rows(items, listLabel)}</>;
  const fresh = items.filter((item) => !item.read);
  const earlier = items.filter((item) => item.read);
  return (
    <>
      {fresh.length > 0 && <section aria-labelledby={`${uid}-new`}><h3 id={`${uid}-new`} className={styles.sectionHead}>{tx("Nowe", "New")}</h3>{rows(fresh, tx("Nowe", "New"))}</section>}
      {earlier.length > 0 && <section aria-labelledby={`${uid}-earlier`}><h3 id={`${uid}-earlier`} className={styles.sectionHead}>{tx("Wcześniejsze", "Earlier")}</h3>{rows(earlier, tx("Wcześniejsze", "Earlier"))}</section>}
    </>
  );
}
