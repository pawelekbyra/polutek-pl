/** @vitest-environment jsdom */
import { act, renderHook, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useNotificationFeed } from '@/app/components/notifications/useNotificationFeed';

const item = { id: 'n1', type: 'comment_like', title: 'Like', body: '', kind: 'COMMENT', href: '/watch/first#comment-c1', read: false, createdAt: '2026-10-28T10:00:00.000Z' };
const page = (extra = {}) => ({ items: [item], nextCursor: null, unreadCount: 1, snapshotAt: '2026-10-28T11:00:00.000Z', ...extra });
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const deferred = () => { let resolve!: (value: Response) => void; const promise = new Promise<Response>((done) => { resolve = done; }); return { promise, resolve }; };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('notification feed consistency', () => {
  it('ignores an older count that arrives after the full page', async () => {
    const count = deferred();
    vi.stubGlobal('fetch', vi.fn((url: string) => url.includes('unread-count') ? count.promise : Promise.resolve(json(page()))));
    const { result } = renderHook(() => useNotificationFeed(true, 'pl'));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await act(async () => count.resolve(json({ unreadCount: 9 })));
    expect(result.current.unread).toBe(1);
  });

  it('does not let a late refresh undo an optimistic read; duplicate clicks write once', async () => {
    const stale = deferred(); const write = deferred(); let reads = 0;
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') return write.promise;
      if (url.includes('unread-count')) return Promise.resolve(json({ unreadCount: 1 }));
      reads++; return reads === 2 ? stale.promise : Promise.resolve(json(page({ items: [{ ...item, read: reads > 2 }], unreadCount: reads > 2 ? 0 : 1 })));
    });
    vi.stubGlobal('fetch', fetch);
    const { result } = renderHook(() => useNotificationFeed(true, 'pl'));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => { void result.current.refresh(); result.current.markRead('n1'); result.current.markRead('n1'); });
    await act(async () => stale.resolve(json(page())));
    expect(result.current.items[0].read).toBe(true);
    expect(result.current.unread).toBe(0);
    await act(async () => write.resolve(json({ updated: 1, unreadCount: 0 })));
    await waitFor(() => expect(result.current.writing).toBe(false));
    expect(fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  });

  it('rolls back a failed write and exposes an error instead of silently losing the unread badge', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === 'POST' ? json({}, 503) : url.includes('unread-count') ? json({ unreadCount: 1 }) : json(page()))));
    const { result } = renderHook(() => useNotificationFeed(true, 'pl'));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => { void result.current.markRead('n1'); });
    await waitFor(() => expect(result.current.writeError).toBe(true));
    expect(result.current.items[0].read).toBe(false);
    expect(result.current.unread).toBe(1);
  });

  it('sends the first-page snapshot when marking all read and prevents duplicate pagination', async () => {
    const older = deferred(); let body: unknown;
    vi.stubGlobal('fetch', vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') { body = JSON.parse(String(options.body)); return Promise.resolve(json({ updated: 1, unreadCount: 0 })); }
      if (url.includes('cursor=')) return older.promise;
      return Promise.resolve(url.includes('unread-count') ? json({ unreadCount: 1 }) : json(page({ nextCursor: 'cursor' })));
    }));
    const { result } = renderHook(() => useNotificationFeed(true, 'pl'));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    act(() => { void result.current.loadMore(); void result.current.loadMore(); });
    await act(async () => older.resolve(json(page({ items: [], snapshotAt: '2026-10-28T12:00:00.000Z' }))));
    act(() => { void result.current.markRead(); });
    await waitFor(() => expect(body).toEqual({ all: true, before: '2026-10-28T11:00:00.000Z' }));
  });
});

describe('notification center history and recovery', () => {
  const older = { ...item, id: 'older', createdAt: '2026-10-27T10:00:00Z' };
  const newest = { ...item, id: 'new', createdAt: '2026-10-28T10:30:00Z' };

  it('preserves older pages and the cursor through background refresh and read mutations; new arrivals wait for a user action', async () => {
    let refreshed = false;
    const calls = vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') return Promise.resolve(json({ unreadCount: 2 }));
      if (url.includes('unread-count')) return Promise.resolve(json({ unreadCount: 3 }));
      if (url.includes('ids=')) return Promise.resolve(json(page({ items: [item, older] })));
      if (url.includes('cursor=')) return Promise.resolve(json(page({ items: [older], nextCursor: 'older-next' })));
      return Promise.resolve(json(page({ items: refreshed ? [newest, item] : [item], nextCursor: 'first-next' })));
    });
    vi.stubGlobal('fetch', calls);
    const { result } = renderHook(() => useNotificationFeed(true, 'pl'));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await act(async () => { await result.current.loadMore(); });
    refreshed = true;
    await act(async () => { await result.current.refresh(); });
    expect(result.current.items.map((i) => i.id)).toEqual(['n1', 'older']);
    expect(result.current.nextCursor).toBe('older-next');
    expect(result.current.hasNew).toBe(true);
    await act(async () => { await result.current.showNew(); });
    expect(result.current.items.map((i) => i.id)).toEqual(['new', 'n1', 'older']);
    expect(result.current.nextCursor).toBe('older-next');
    await act(async () => { await result.current.markRead('older'); });
    expect(result.current.items).toHaveLength(3);
    expect(result.current.items[2].read).toBe(true);
    expect(result.current.nextCursor).toBe('older-next');
  });

  it('keeps the list usable when a later page fails and retries that same cursor', async () => {
    let fail = true;
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(url.includes('unread-count') ? json({ unreadCount: 2 }) : url.includes('cursor=') ? fail ? json({}, 503) : json(page({ items: [older] })) : json(page({ nextCursor: 'same-cursor' })))));
    const { result } = renderHook(() => useNotificationFeed(true, 'pl'));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await act(async () => { await result.current.loadMore(); });
    expect(result.current.moreError).toBe(true);
    expect(result.current.status).toBe('idle');
    expect(result.current.items).toHaveLength(1);
    expect(result.current.nextCursor).toBe('same-cursor');
    fail = false;
    await act(async () => { await result.current.loadMore(); });
    expect(result.current.moreError).toBe(false);
    expect(result.current.items).toHaveLength(2);
  });

  it('marks a read message unread, with a server-confirmed count and an account-scoped content-free broadcast', async () => {
    const channels: { name: string; postMessage: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn>; onmessage: unknown }[] = [];
    vi.stubGlobal('BroadcastChannel', class {
      name: string; postMessage = vi.fn(); close = vi.fn(); onmessage = null;
      constructor(name: string) { this.name = name; channels.push(this); }
    });
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === 'POST' ? json({ unreadCount: 1 }) : url.includes('unread-count') ? json({ unreadCount: 1 }) : json(page({ items: [{ ...item, read: true }], unreadCount: 0 }))));
    vi.stubGlobal('fetch', fetch);
    const { result, unmount } = renderHook(() => useNotificationFeed(true, 'en', 'all', 'account-a'));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    await act(async () => { await result.current.markRead('n1', false); });
    expect(result.current.items[0].read).toBe(false);
    expect(result.current.unread).toBe(1);
    expect(fetch.mock.calls.some(([url]) => url.includes('language=en'))).toBe(true);
    const request = fetch.mock.calls.find(([, options]) => options?.method === 'POST');
    expect(JSON.parse(String(request?.[1]?.body))).toEqual({ id: 'n1', read: false });
    expect(channels[0].name).toBe('polutek:notifications:account-a');
    expect(channels[0].postMessage).toHaveBeenCalledWith({ type: 'changed' });
    unmount(); expect(channels[0].close).toHaveBeenCalled();
  });

  it('bounds catch-up work and resumes without publishing a gap or losing old pages', async () => {
    let probe = false;
    const make = (n: number) => ({ ...item, id: `n${n}`, createdAt: new Date(Date.UTC(2026, 9, 28, 10, n)).toISOString() });
    const fetch = vi.fn((url: string) => {
      if (url.includes('unread-count')) return Promise.resolve(json({ unreadCount: 13 }));
      if (url.includes('ids=')) return Promise.resolve(json(page({ items: [make(0)] })));
      const cursor = /cursor=(\d+)/.exec(url);
      const n = cursor ? Number(cursor[1]) : probe ? 12 : 0;
      return Promise.resolve(json(page({ items: [make(n)], nextCursor: n > 0 ? String(n - 1) : 'old-history' })));
    });
    vi.stubGlobal('fetch', fetch);
    const { result } = renderHook(() => useNotificationFeed(true, 'pl'));
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    probe = true;
    await act(async () => { await result.current.refresh(); });
    let shown: boolean | undefined;
    await act(async () => { shown = await result.current.showNew(); });
    expect(shown).toBe(false); expect(result.current.items).toHaveLength(1);
    expect(fetch.mock.calls.filter(([url]) => url.includes('cursor=')).length).toBe(5);
    await act(async () => { shown = await result.current.showNew(); });
    expect(shown).toBe(false); expect(result.current.items).toHaveLength(1);
    await act(async () => { shown = await result.current.showNew(); });
    expect(shown).toBe(true); expect(result.current.items).toHaveLength(13);
    expect(result.current.nextCursor).toBe('old-history');
    expect(result.current.hasNew).toBe(false);
  });
});
