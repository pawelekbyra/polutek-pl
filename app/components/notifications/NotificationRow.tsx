"use client";

import { useId, useState, type MouseEvent } from "react";
import type { Locale } from "@/lib/i18n/routing";
import type { Tx } from "@/lib/i18n/ui";
import type { UserNotificationDTO } from "@/lib/modules/notifications";
import { NotificationIcon } from "./NotificationIcon";
import { formatNotificationAge } from "./notification-events";
import styles from "./notification-panel.module.css";

type Props = {
  item: UserNotificationDTO;
  link: { href: string | null; external: boolean };
  language: Locale;
  tx: Tx;
  now: number;
  pending: boolean;
  onRead: (read: boolean) => void;
  onFollow: (event: MouseEvent, href: string, external: boolean) => void;
};

/** A real list item: the destination, message expansion and the read dot are separate controls. */
export function NotificationRow({ item, link, language, tx, now, pending, onRead, onFollow }: Props) {
  const [expanded, setExpanded] = useState(false);
  const titleId = useId();
  const contentId = useId();
  const readLabel = item.read ? tx("Oznacz jako nieprzeczytane", "Mark as unread") : tx("Oznacz jako przeczytane", "Mark as read");
  const longTitle = item.title.length > 45;
  const hasFullMessage = item.body.length > 80 || longTitle;
  const controlledContent = item.body.length > 80 ? contentId : longTitle ? titleId : undefined;
  const content = <>
    <span id={titleId} className={`${styles.itemTitle} ${expanded ? "" : styles.clamp} ${item.read ? styles.readTitle : ""}`}>
      {item.title}
      {!item.read && <span className="sr-only"> ({tx("nieprzeczytane", "unread")})</span>}
    </span>
    {item.body && <span id={contentId} className={`${styles.itemBody} ${expanded ? "" : styles.clamp}`}>{item.body}</span>}
  </>;
  return (
    <li className={`${styles.item} ${item.read ? "" : styles.unread}`} aria-labelledby={titleId} data-notification-id={item.id}>
      <NotificationIcon type={item.type} unread={!item.read} />
      <div className={styles.itemText}>
        {link.href ? (
          <a className={styles.destination} href={link.href} {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            onClick={(event) => { if (!item.read) onRead(true); onFollow(event, link.href!, link.external); }}>
            {content}
          </a>
        ) : (
          <button type="button" className={styles.destination} aria-expanded={expanded} aria-controls={controlledContent} onClick={() => setExpanded((value) => !value)}>
            {content}
          </button>
        )}
        <div className={styles.itemMeta}>
          <time className={item.read ? "" : styles.freshTime} dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString(language, { dateStyle: "medium", timeStyle: "short" })}>
            {formatNotificationAge(item.createdAt, language, now)}
          </time>
          {hasFullMessage && (
            <button type="button" className={styles.expand} aria-expanded={expanded} aria-controls={controlledContent} onClick={() => setExpanded((value) => !value)}>
              {expanded ? tx("Zwiń wiadomość", "Collapse message") : tx("Pokaż całą wiadomość", "Show full message")}
            </button>
          )}
        </div>
      </div>
      <button type="button" className={styles.readButton} disabled={pending} aria-label={`${readLabel}: ${item.title}`} title={readLabel} onClick={() => onRead(!item.read)}>
        <span aria-hidden="true" className={item.read ? styles.dotRead : styles.dotUnread} />
      </button>
    </li>
  );
}
