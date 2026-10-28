"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UserNotificationDTO, UserNotificationPage } from "@/lib/modules/notifications";
import { NOTIFICATIONS_CHANGED_EVENT } from "./notification-events";

const PAGE_SIZE = 10;
const POLL_MS = 60_000;

async function readJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal });
  if (!response.ok) throw new Error("Notification request failed");
  return response.json() as Promise<T>;
}

/** Request generations keep delayed pages/counts from undoing a read or replacing a newer page. */
export function useNotificationFeed(open: boolean, language: string) {
  const [items, setItems] = useState<UserNotificationDTO[]>([]);
  const [countReady, setCountReady] = useState(false);
  const [unread, setUnread] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [loadingMore, setLoadingMore] = useState(false);
  const [writeError, setWriteError] = useState(false);
  const [writing, setWriting] = useState(false);
  const epoch = useRef(0);
  const pageRequest = useRef(0);
  const countRequest = useRef(0);
  const pending = useRef(0);
  const moreLock = useRef(false);
  const mounted = useRef(true);
  const snapshotAt = useRef<string | null>(null);
  const confirmedReads = useRef(new Set<string>());
  const queue = useRef(Promise.resolve());
  const openRef = useRef(open);
  useEffect(() => { openRef.current = open; }, [open]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; epoch.current++; };
  }, []);

  const pollCount = useCallback(async () => {
    const generation = epoch.current;
    const request = ++countRequest.current;
    try {
      const data = await readJson<{ unreadCount: number }>("/api/user/notifications/unread-count");
      if (mounted.current && generation === epoch.current && request === countRequest.current && pending.current === 0) { setUnread(data.unreadCount); setCountReady(true); }
    } catch { /* Keep the last confirmed count when offline. */ }
  }, []);

  const refresh = useCallback(async () => {
    const generation = epoch.current;
    const request = ++pageRequest.current;
    countRequest.current++;
    setStatus("loading");
    try {
      const page = await readJson<UserNotificationPage>(`/api/user/notifications?limit=${PAGE_SIZE}`);
      if (!mounted.current || generation !== epoch.current || request !== pageRequest.current || pending.current > 0) return;
      setItems(page.items.map((item) => confirmedReads.current.has(item.id) ? { ...item, read: true } : item));
      setNextCursor(page.nextCursor);
      setUnread(page.unreadCount);
      setCountReady(true);
      confirmedReads.current.clear();
      snapshotAt.current = page.snapshotAt ?? new Date().toISOString();
      setStatus("idle");
    } catch {
      if (mounted.current && generation === epoch.current && request === pageRequest.current) setStatus("error");
    }
  }, []);

  useEffect(() => {
    const onChanged = () => { if (openRef.current) void refresh(); else void pollCount(); };
    const onVisible = () => { if (document.visibilityState === "visible") onChanged(); };
    void pollCount();
    const timer = window.setInterval(onVisible, POLL_MS);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pollCount, refresh]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, language, refresh]);

  const loadMore = async () => {
    if (!nextCursor || moreLock.current || pending.current > 0) return;
    moreLock.current = true;
    setLoadingMore(true);
    const generation = epoch.current;
    const request = pageRequest.current;
    try {
      const page = await readJson<UserNotificationPage>(`/api/user/notifications?limit=${PAGE_SIZE}&cursor=${encodeURIComponent(nextCursor)}`);
      if (!mounted.current || generation !== epoch.current || request !== pageRequest.current) return;
      setItems((current) => [...current, ...page.items.filter((item) => !current.some((existing) => existing.id === item.id)).map((item) => confirmedReads.current.has(item.id) ? { ...item, read: true } : item)]);
      setNextCursor(page.nextCursor);
      setStatus("idle");
    } catch {
      if (mounted.current && generation === epoch.current && request === pageRequest.current) setStatus("error");
    } finally {
      moreLock.current = false;
      if (mounted.current) setLoadingMore(false);
    }
  };

  const markRead = (id?: string) => {
    const changed = items.filter((item) => !item.read && (!id || item.id === id) && !confirmedReads.current.has(item.id));
    if (id && changed.length === 0) return;
    if (!id && (pending.current > 0 || !snapshotAt.current)) return;
    const priorUnread = unread;
    changed.forEach((item) => confirmedReads.current.add(item.id));
    setItems((current) => current.map((item) => !id || item.id === id ? { ...item, read: true } : item));
    setUnread((count) => id ? Math.max(0, count - changed.length) : count);
    setWriteError(false);
    setWriting(true);
    epoch.current++;
    pending.current++;
    const body = id ? { id } : { all: true, before: snapshotAt.current };
    queue.current = queue.current.then(async () => {
      if (!mounted.current) { pending.current--; return; }
      try {
        const response = await fetch("/api/user/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true });
        if (!response.ok) throw new Error("Read was not saved");
        const saved = await response.json() as { unreadCount?: number };
        if (mounted.current && pending.current === 1 && typeof saved.unreadCount === "number") setUnread(saved.unreadCount);
      } catch {
        changed.forEach((item) => confirmedReads.current.delete(item.id));
        if (mounted.current) {
          const ids = new Set(changed.map((item) => item.id));
          setItems((current) => current.map((item) => ids.has(item.id) ? { ...item, read: false } : item));
          setUnread((count) => id ? count + changed.length : priorUnread);
          setWriteError(true);
        }
      } finally {
        pending.current--;
        if (mounted.current && pending.current === 0) {
          epoch.current++;
          setWriting(false);
          if (openRef.current) void refresh(); else void pollCount();
        }
      }
    });
  };

  return { items, unread, countReady, nextCursor, status, loadingMore, writing, writeError, refresh, loadMore, markRead };
}
