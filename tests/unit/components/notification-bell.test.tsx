/** @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import NotificationBell from '@/app/components/notifications/NotificationBell';
import { txFor } from '../i18n/mock-language';
const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/app/components/LanguageContext', () => ({ useLanguage: () => ({ language: 'pl', tx: txFor('pl') }) }));

const item = (id: string, type: string, href: string | null = '/watch/first#comment-c1') => ({ id, type, kind: 'COMMENT', title: `Notification ${id}`, body: 'A comment', href, read: false, createdAt: '2026-10-28T10:00:00.000Z' });
const json = (data: unknown) => new Response(JSON.stringify(data));
beforeEach(() => {
  mocks.push.mockClear();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('fetch', vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === 'POST' ? json({ updated: 1, unreadCount: 1 }) : url.includes('unread-count') ? json({ unreadCount: 2 }) : json({ items: [item('like', 'comment_like'), item('reply', 'comment_reply', null)], unreadCount: 2, nextCursor: null, snapshotAt: '2026-10-28T11:00:00.000Z' }))));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('notification bell interactions', () => {
  it('shows a distinct decorative event icon and uses client navigation instead of an anchor reload', async () => {
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole('button', { name: /Powiadomienia/ }));
    const link = await screen.findByRole('menuitem', { name: /Notification like/ });
    expect(link.querySelector('[data-notification-type="comment_like"] svg')).not.toBeNull(); // Marker set B, not lucide
    expect(link.querySelector('svg.lucide')).toBeNull();
    expect(link.querySelector('svg')?.parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('menuitem', { name: /Notification reply/ }).querySelector('[data-notification-type="comment_reply"] svg')).not.toBeNull();
    expect(link).toHaveAttribute('href', '/watch/first#comment-c1');
    fireEvent.click(link);
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/watch/first#comment-c1', { scroll: false }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    const writes = vi.mocked(fetch).mock.calls.filter(([, options]) => options?.method === 'POST');
    expect(JSON.parse(String(writes[0][1]?.body))).toEqual({ id: 'like' });
  });

  it('opens from the keyboard and returns focus to the bell on Escape', async () => {
    render(<NotificationBell />);
    const bell = screen.getByRole('button', { name: /Powiadomienia/ });
    bell.focus();
    fireEvent.keyDown(bell, { key: 'ArrowDown' });
    await screen.findByRole('menuitem', { name: /Notification like/ });
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    await waitFor(() => expect(bell).toHaveFocus());
  });
});
