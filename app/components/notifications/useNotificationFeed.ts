"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { UserNotificationDTO, UserNotificationPage } from "@/lib/modules/notifications";
import { NOTIFICATIONS_CHANGED_EVENT, notificationChannelName } from "./notification-events";
import { mergeNotifications, newestFirst, notificationPage, notificationRequest } from "./notification-feed-client";

const PAGE_SIZE = 20;
const POLL_MS = 60_000;
export type NotificationFilter = "all" | "unread";
type ReadAction = { id?: string; read: boolean; before?: string };

/** Own-account state. Silent probes reconcile rows without discarding pagination or inserting above the reading cursor. */
export function useNotificationFeed(open: boolean, language: string, filter: NotificationFilter = "all", accountId?: string | null, pageSize = PAGE_SIZE) {
  const [items, setItems] = useState<UserNotificationDTO[]>([]);
  const [countReady, setCountReady] = useState(false);
  const [unread, setUnread] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [writeError, setWriteError] = useState(false);
  const [writing, setWriting] = useState(false);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [hasNew, setHasNew] = useState(false);
  const epoch = useRef(0);
  const pageRequest = useRef(0);
  const countRequest = useRef(0);
  const pending = useRef(0);
  const moreLock = useRef(false);
  const refreshingLock = useRef(false);
  const mounted = useRef(true);
  const initialized = useRef(false);
  const snapshotAt = useRef<string | null>(null);
  const latestHead = useRef<UserNotificationPage | null>(null);
  const catchup = useRef<{ head: UserNotificationPage; page: UserNotificationPage; incoming: UserNotificationDTO[] } | null>(null);
  const optimistic = useRef(new Map<string, boolean>());
  const queue = useRef(Promise.resolve());
  const failedWrite = useRef<ReadAction | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const itemsRef = useRef(items);
  const openRef = useRef(open);
  const filterRef = useRef(filter);
  useLayoutEffect(() => {
    openRef.current = open;
    filterRef.current = filter;
    itemsRef.current = items;
  }, [open, filter, items]);
  const url = useCallback((extra = "") => `/api/user/notifications?limit=${pageSize}&language=${encodeURIComponent(language)}${filter === "unread" ? "&unread=1" : ""}${extra}`, [language, filter, pageSize]);
  const overlay = useCallback((rows: UserNotificationDTO[]) => rows.map((item) => optimistic.current.has(item.id) ? { ...item, read: optimistic.current.get(item.id)! } : item), []);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; epoch.current++; };
  }, []);

  const pollCount = useCallback(async () => {
    const generation = epoch.current;
    const request = ++countRequest.current;
    try {
      const data = await notificationRequest<{ unreadCount: number }>("/api/user/notifications/unread-count");
      if (mounted.current && generation === epoch.current && request === countRequest.current && pending.current === 0 && Number.isInteger(data.unreadCount) && data.unreadCount >= 0) {
        setUnread(data.unreadCount); setCountReady(true);
      }
    } catch { /* Keep the last confirmed badge while offline. The open panel exposes a refresh error. */ }
  }, []);

  const refresh = useCallback(async () => {
    if (refreshingLock.current || moreLock.current || pending.current > 0) return;
    refreshingLock.current = true;
    const generation = epoch.current;
    const request = ++pageRequest.current;
    countRequest.current++;
    const initial = !initialized.current;
    if (initial) setStatus("loading"); else setRefreshing(true);
    setRefreshError(false);
    try {
      const page = notificationPage(await notificationRequest<UserNotificationPage>(url()));
      if (!mounted.current || generation !== epoch.current || request !== pageRequest.current || pending.current > 0) return;
      if (initial) {
        initialized.current = true;
        snapshotAt.current = page.snapshotAt;
        setItems(overlay(page.items)); setNextCursor(page.nextCursor); setStatus("idle");
      } else {
        const known = new Set(itemsRef.current.map((item) => item.id));
        const incoming = page.items.filter((item) => !known.has(item.id) && (!itemsRef.current[0] || newestFirst(item, itemsRef.current[0]) < 0));
        latestHead.current = page;
        setHasNew(incoming.length > 0);
        // Refresh the state and text of loaded rows, including older rows changed in another tab/device.
        const patches = new Map(page.items.map((item) => [item.id, item]));
        const knownIds = itemsRef.current.map((item) => item.id);
        const retained = new Set<string>();
        for (let offset = 0; offset < knownIds.length; offset += 50) {
          const batch = notificationPage(await notificationRequest<UserNotificationPage>(url(`&ids=${encodeURIComponent(knownIds.slice(offset, offset + 50).join(","))}`)));
          if (!mounted.current || generation !== epoch.current || request !== pageRequest.current || pending.current > 0) return;
          batch.items.forEach((item) => { patches.set(item.id, item); retained.add(item.id); });
        }
        setItems((current) => overlay(current.filter((item) => retained.has(item.id) || optimistic.current.has(item.id)).map((item) => patches.get(item.id) ?? item)).filter((item) => filter !== "unread" || !item.read));
        setStatus("idle");
      }
      setUnread(page.unreadCount); setCountReady(true);
    } catch {
      if (mounted.current && generation === epoch.current && request === pageRequest.current) {
        if (initial) setStatus("error"); else setRefreshError(true);
      }
    } finally {
      if (request === pageRequest.current) { refreshingLock.current = false; if (mounted.current) setRefreshing(false); }
    }
  }, [url, overlay, filter]);
  const refreshRef = useRef(refresh);
  useLayoutEffect(() => { refreshRef.current = refresh; }, [refresh]);

  useEffect(() => {
    const onChanged = () => { if (openRef.current) void refreshRef.current(); else void pollCount(); };
    const onVisible = () => { if (document.visibilityState === "visible") onChanged(); };
    void pollCount();
    const timer = window.setInterval(onVisible, POLL_MS);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    window.addEventListener("online", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    if (accountId && typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel(notificationChannelName(accountId));
      channel.current.onmessage = (event) => { if (event.data?.type === "changed") onVisible(); };
    }
    return () => {
      clearInterval(timer); channel.current?.close(); channel.current = null;
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
      window.removeEventListener("online", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [accountId, pollCount]);

  useEffect(() => {
    epoch.current++; pageRequest.current++; initialized.current = false; refreshingLock.current = false;
    snapshotAt.current = null; latestHead.current = null; catchup.current = null;
    setItems([]); setNextCursor(null); setHasNew(false); setMoreError(false); setRefreshError(false); setStatus("loading");
    if (openRef.current) void refreshRef.current();
  }, [language, filter]);

  useEffect(() => { if (open) void refreshRef.current(); }, [open]);

  const loadMore = async () => {
    if (!nextCursor || moreLock.current || pending.current > 0) return;
    moreLock.current = true; setLoadingMore(true); setMoreError(false);
    const generation = epoch.current;
    const request = pageRequest.current;
    try {
      const page = notificationPage(await notificationRequest<UserNotificationPage>(url(`&cursor=${encodeURIComponent(nextCursor)}`)));
      if (!mounted.current || generation !== epoch.current || request !== pageRequest.current) return;
      setItems((current) => mergeNotifications(current, overlay(page.items))); setNextCursor(page.nextCursor);
    } catch {
      if (mounted.current && generation === epoch.current && request === pageRequest.current) setMoreError(true);
    } finally { moreLock.current = false; if (mounted.current) setLoadingMore(false); }
  };

  const showNew = async (): Promise<boolean> => {
    if (!latestHead.current || moreLock.current || pending.current > 0) return false;
    moreLock.current = true; setRefreshing(true); setRefreshError(false);
    const generation = epoch.current;
    const request = ++pageRequest.current;
    try {
      const head = catchup.current?.head ?? latestHead.current;
      const knownTop = itemsRef.current[0];
      let page = catchup.current?.page ?? head;
      let incoming = catchup.current?.incoming ?? page.items;
      let fetched = 0;
      const started = Date.now();
      // A busy channel may have produced more than one page. Fill the gap before publishing the new head.
      while (knownTop && page.nextCursor && page.items.length && newestFirst(page.items[page.items.length - 1], knownTop) < 0) {
        if (fetched >= 5 || Date.now() - started >= 8_000) { catchup.current = { head, page, incoming }; return false; }
        fetched++;
        page = notificationPage(await notificationRequest<UserNotificationPage>(url(`&cursor=${encodeURIComponent(page.nextCursor)}`)));
        if (!mounted.current || generation !== epoch.current || request !== pageRequest.current) return false;
        incoming = mergeNotifications(incoming, page.items);
      }
      if (!mounted.current || generation !== epoch.current || request !== pageRequest.current) return false;
      if (!itemsRef.current.length) setNextCursor(head.nextCursor);
      setItems((current) => mergeNotifications(current, overlay(incoming)));
      snapshotAt.current = head.snapshotAt; latestHead.current = null; catchup.current = null; setHasNew(false);
      setUnread(head.unreadCount); setCountReady(true);
      return true;
    } catch { if (mounted.current && generation === epoch.current) setRefreshError(true); return false; }
    finally { moreLock.current = false; if (mounted.current) setRefreshing(false); }
  };

  const runReadAction = (action: ReadAction): Promise<void> => {
    if (pending.current > 0) return Promise.resolve();
    const current = itemsRef.current;
    const changed = current.filter((item) => item.read !== action.read && (!action.id || item.id === action.id) && !optimistic.current.has(item.id));
    if (action.id && changed.length === 0) return Promise.resolve();
    if (!action.id && (pending.current > 0 || !snapshotAt.current)) return Promise.resolve();
    const changedIds = new Set(changed.map((item) => item.id));
    changed.forEach((item) => optimistic.current.set(item.id, action.read));
    setItems((rows) => rows.map((item) => changedIds.has(item.id) ? { ...item, read: action.read } : item));
    if (action.id) setUnread((count) => Math.max(0, count + (action.read ? -changed.length : changed.length)));
    setWriteError(false); setWriting(true); setPendingIds([...optimistic.current.keys()]);
    epoch.current++; pending.current++;
    const body = action.id ? { id: action.id, ...(action.read ? {} : { read: false }) } : { all: true, before: action.before ?? snapshotAt.current };
    queue.current = queue.current.then(async () => {
      if (!mounted.current) { pending.current--; return; }
      try {
        const result = await notificationRequest<{ unreadCount: number }>("/api/user/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true });
        if (mounted.current && pending.current === 1 && Number.isInteger(result.unreadCount)) setUnread(result.unreadCount);
        channel.current?.postMessage({ type: "changed" });
        if (mounted.current) {
          failedWrite.current = null;
          if (filterRef.current === "unread" && action.read) setItems((rows) => rows.filter((item) => !changedIds.has(item.id)));
        }
      } catch {
        if (mounted.current) {
          setItems((rows) => rows.map((item) => changedIds.has(item.id) ? { ...item, read: !action.read } : item));
          if (action.id) setUnread((count) => Math.max(0, count + (action.read ? changed.length : -changed.length)));
          failedWrite.current = action; setWriteError(true);
        }
      } finally {
        changedIds.forEach((id) => optimistic.current.delete(id)); pending.current--;
        if (mounted.current) {
          setPendingIds([...optimistic.current.keys()]);
          if (pending.current === 0) {
            epoch.current++; setWriting(false);
            // Count reconciliation is enough after writes; it must never reset loaded history.
            void pollCount();
          }
        }
      }
    });
    return queue.current;
  };
  const markRead = (id?: string, read = true) => runReadAction({ id, read, ...(!id && snapshotAt.current ? { before: snapshotAt.current } : {}) });
  const retryWrite = () => failedWrite.current ? runReadAction(failedWrite.current) : Promise.resolve();

  return { items, unread, countReady, nextCursor, status, refreshing, refreshError, loadingMore, moreError, writing, pendingIds, writeError, hasNew, refresh, loadMore, showNew, markRead, retryWrite };
}
