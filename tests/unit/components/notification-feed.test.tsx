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
    act(() => result.current.markRead('n1'));
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
    act(() => result.current.markRead());
    await waitFor(() => expect(body).toEqual({ all: true, before: '2026-10-28T11:00:00.000Z' }));
  });
});
